import { DisconnectReason, fetchLatestBaileysVersion, makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { emitQrStatusUpdate } from '../app.js';
import flyers from "../config/flyers.json" with { type: "json" };
import { getWhatsAppConfig } from '../config/whatsapp.config.js';
import { getLeadTemplate, getTemplate, getTemplateNHL } from '../templates.js';
import logger from '../utils/logger.js';
import authPathInfo from '../utils/ruta_authinfo.js';

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  console.error('❌ Uncaught Exception:', error.message);
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason: reason?.message || reason });
  console.error('❌ Unhandled Rejection:', reason);
});

// Estado centralizado
const connectionState = {
  socket: null,
  qrData: null,
  isConnecting: false,
  userConnections: new Map(),
  sentMessages: [],
  connectionStatus: 'disconnected',
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectTimer: null,
  isReconnecting: false,
  lastConnectionAttempt: 0
};

// Función para limpiar completamente el estado
async function cleanupConnection() {
  try {
    if (connectionState.socket) {
      try {
        if (connectionState.socket.ev) {
          connectionState.socket.ev.removeAllListeners();
        }
        await connectionState.socket.end();
        logger.info('Connection closed successfully');
      } catch (error) {
        logger.debug('Error closing connection', { error: error.message });
      }
    }
  } catch (error) {
    logger.error('Error in cleanupConnection', { error: error.message });
  } finally {
    // Reseteamos todo EXCEPTO los bloqueos, que se manejan en los flujos
    connectionState.socket = null;
    connectionState.qrData = null;
    connectionState.connectionStatus = 'disconnected';
  }
}

// Función para obtener estado del QR
function getQRStatus() {
  const now = Date.now();
  const hasActiveQR = !!connectionState.qrData && now < connectionState.qrData.expiresAt;

  let qrInfo = null;
  if (connectionState.qrData) {
    const timeRemaining = Math.floor((connectionState.qrData.expiresAt - now) / 1000);
    qrInfo = {
      ...connectionState.qrData,
      timeRemaining: timeRemaining > 0 ? timeRemaining : 0,
      isExpired: timeRemaining <= 0,
      age: Math.floor((now - new Date(connectionState.qrData.createdAt).getTime()) / 1000)
    };
  }

  return {
    hasActiveQR,
    qrData: qrInfo,
    isConnected: connectionState.connectionStatus === 'connected',
    connectionState: {
      isConnecting: connectionState.isConnecting,
      hasSocket: !!connectionState.socket,
      socketStatus: connectionState.connectionStatus,
      status: connectionState.connectionStatus,
      reconnectAttempts: connectionState.reconnectAttempts,
      isReconnecting: connectionState.isReconnecting
    },
    lastUpdated: new Date().toISOString()
  };
}

// Función para generar QR desde la actualización de conexión
async function generateQRFromUpdate(qrString) {
  try {
    const qrResult = await generateOptimalQR(qrString, 'PNG');

    connectionState.qrData = {
      image: qrResult.image,
      expiresAt: Date.now() + (60000 * 2), // 2 minutos
      createdAt: new Date().toISOString(),
      qrString: qrString,
      format: qrResult.format,
      size: qrResult.size,
      mimeType: qrResult.mimeType,
      fallback: qrResult.fallback || false
    };

    emitQrStatusUpdate(getQRStatus());
    logger.info('QR generated from connection update', { format: qrResult.format });
  } catch (error) {
    logger.error('Error generating QR from update', { error: error.message });
  }
}

// Función para generar QR con timeout
async function generateNewQR(session) {
  return new Promise((resolve, reject) => {
    try {
      const config = getWhatsAppConfig();
      const qrTimeout = config.stability?.qrTimeout || 15000;

      const timeoutId = setTimeout(() => {
        try {
          session.ev.off('connection.update', qrHandler);
        } catch (error) {
          logger.error('Error removing QR handler', { error: error.message });
        }
        reject(new Error('Timeout al generar QR'));
      }, qrTimeout);

      const qrHandler = (update) => {
        if (update.qr) {
          try {
            clearTimeout(timeoutId);
            session.ev.off('connection.update', qrHandler);

            // Generar QR en formato PNG optimizado
            generateOptimalQR(update.qr, 'PNG')
              .then(qrResult => {
                try {
                  connectionState.qrData = {
                    image: qrResult.image,
                    expiresAt: Date.now() + (config.qr?.expirationTime || 120000),
                    createdAt: new Date().toISOString(),
                    qrString: update.qr,
                    format: qrResult.format,
                    size: qrResult.size,
                    mimeType: qrResult.mimeType,
                    fallback: qrResult.fallback || false
                  };
                  resolve(qrResult.image);
                } catch (error) {
                  logger.error('Error setting QR data', { error: error.message });
                  reject(error);
                }
              })
              .catch(reject);
          } catch (error) {
            logger.error('Error in QR handler', { error: error.message });
            reject(error);
          }
        }
      };

      session.ev.on('connection.update', qrHandler);
    } catch (error) {
      logger.error('Error setting up QR generation', { error: error.message });
      reject(error);
    }
  });
}

// Función para reconexión automática (CORREGIDA)
async function attemptReconnect() {
  const config = getWhatsAppConfig();
  const maxAttempts = config.stability?.maxReconnectAttempts || 5;

  // 1. Prevenir que se apilen las reconexiones
  if (connectionState.isReconnecting) {
    logger.warn('Reconnection already in progress, skipping new attempt.');
    return;
  }

  // 2. Comprobar límite de intentos
  if (connectionState.reconnectAttempts >= maxAttempts) {
    logger.error('Max reconnection attempts reached. Giving up. Please request a new QR manually.');
    connectionState.reconnectAttempts = 0; // Reiniciar
    connectionState.isConnecting = false;
    connectionState.isReconnecting = false;
    connectionState.connectionStatus = 'disconnected';
    emitQrStatusUpdate(getQRStatus());
    return;
  }

  connectionState.isReconnecting = true; // <-- ¡BLOQUEO!
  connectionState.reconnectAttempts++; // Incrementar intentos

  logger.info('Attempting automatic reconnection', {
    attempt: connectionState.reconnectAttempts,
    maxAttempts: maxAttempts
  });

  try {
    await cleanupConnection();
    connectionState.socket = await createNewSession();
    // El evento 'open' o 'close' de createNewSession liberará el bloqueo
  } catch (error) {
    logger.error('Fatal error during createNewSession in attemptReconnect', {
      error: error.message,
      attempt: connectionState.reconnectAttempts
    });
    // Liberar bloqueo si falla catastróficamente
    connectionState.isReconnecting = false;
    connectionState.isConnecting = false;
  }
}

// Función para manejar errores de stream específicamente
function handleStreamError(error, update) {
  const config = getWhatsAppConfig();

  logger.warn('Stream error detected', {
    error: error.message,
    code: update?.lastDisconnect?.error?.data?.attrs?.code,
    statusCode: update?.lastDisconnect?.statusCode
  });

  // Si es un error de stream que requiere restart (código 515)
  if (update?.lastDisconnect?.error?.data?.attrs?.code === '515' ||
    error.message?.includes('Stream Errored') ||
    update?.lastDisconnect?.error?.message?.includes('restart required')) {

    logger.info('Stream error requires restart, attempting reconnection');

    // Limpiar estado actual
    connectionState.connectionStatus = 'disconnected';
    connectionState.isConnecting = false;

    // Intentar reconexión automática
    if (config.stability?.autoReconnect !== false) {
      attemptReconnect();
    }
  }
}

// Función principal para crear nueva sesión
async function createNewSession() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(authPathInfo());
    const { version } = await fetchLatestBaileysVersion();
    const config = getWhatsAppConfig();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: config.security?.printQRInTerminal || false,
      connectTimeoutMs: config.stability?.connectionTimeout || 60000,
      browser: [config.browser?.name || 'TuApp', config.browser?.version || '1.0', config.browser?.os || 'Ubuntu'],

      // --- ¡ARREGLO DE PROXY! ---
      // Más rápido que el timeout del proxy (60s)
      keepAliveIntervalMs: 30000,
      // --- FIN DE ARREGLO ---

      markOnlineOnConnect: config.security?.markOnlineOnConnect !== false,
      syncFullHistory: false,
      shouldIgnoreJid: (jid) => {
        if (!jid || typeof jid !== 'string') return false;
        return jid.includes('@broadcast') || jid.includes('@newsletter');
      },
    });

    sock.ev.on('creds.update', saveCreds);

    // Configurar event handlers (El "Cerebro")
    sock.ev.on('connection.update', (update) => {
      try {
        logger.info('Connection update', {
          connection: update.connection,
          qr: update.qr ? 'present' : 'absent'
        });

        if (update.connection === 'connecting') {
          connectionState.connectionStatus = 'connecting';
          connectionState.isConnecting = true;
          connectionState.lastConnectionAttempt = Date.now();

        } else if (update.connection === 'open') {
          connectionState.connectionStatus = 'connected';
          connectionState.isConnecting = false;
          connectionState.qrData = null;
          connectionState.reconnectAttempts = 0; // ¡ÉXITO! Reiniciar contador
          connectionState.isReconnecting = false; // ¡ÉXITO! Liberar bloqueo
          if (connectionState.reconnectTimer) clearTimeout(connectionState.reconnectTimer); // Limpiar timer

          logger.info('WhatsApp connected successfully');
          emitQrStatusUpdate(getQRStatus());

        } else if (update.connection === 'close') {
          connectionState.connectionStatus = 'disconnected';
          connectionState.isConnecting = false;
          connectionState.isReconnecting = false; // Liberar bloqueo

          const lastDisconnect = update.lastDisconnect;
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const reason = lastDisconnect?.error?.message || 'unknown';

          logger.warn('Connection closed', {
            reason: reason,
            statusCode: statusCode,
            attempt: connectionState.reconnectAttempts
          });

          // Códigos de "Cierre de sesión" que NO deben reintentarse
          const shouldReconnect = (statusCode !== 401 && statusCode !== 428 && statusCode !== 440);

          if (shouldReconnect) {
            logger.info('Scheduling reconnect due to connection close...');
            if (connectionState.reconnectTimer) clearTimeout(connectionState.reconnectTimer);

            // Programar reintento con retraso para no saturar
            const delay = config.stability?.reconnectDelay || 3000;
            connectionState.reconnectTimer = setTimeout(attemptReconnect, delay);

          } else {
            logger.error('NOT reconnecting. Reason:', { reason, statusCode });
            connectionState.reconnectAttempts = 0; // Reiniciar contador
            if (statusCode === 401 || statusCode === 440) {
              logger.info('Credentials logged out or invalid. Clearing auth info.');
              // Opcional: Borrar sesión para forzar nuevo QR
              // try { fs.rmSync(authPathInfo(), { recursive: true, force: true }); } catch (e) { logger.error('Error clearing auth info', e); }
            }
          }

          emitQrStatusUpdate(getQRStatus());
        }

        // Manejar QR
        if (update.qr) {
          logger.info('New QR received');
          generateQRFromUpdate(update.qr);
          connectionState.isConnecting = false;
        }
      } catch (error) {
        logger.error('Error handling connection update', { error: error.message, stack: error.stack });
      }
    });

    // ... (Tus setIntervals de keep-alive se quedan igual, aunque el de 5 min ya no es tan necesario)
    // ...

    return sock;
  } catch (error) {
    logger.error('Error creating new session', { error: error.message, stack: error.stack });
    throw error;
  }
}

// Función para generar QR en el formato óptimo
async function generateOptimalQR(qrString, format = 'PNG') {
  try {
    let qrImage;
    let qrConfig;

    switch (format.toUpperCase()) {
      case 'PNG':
        // PNG es el más compatible y estable para WhatsApp
        qrConfig = {
          type: 'image/png',
          quality: 0.92,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          width: 256,
          errorCorrectionLevel: 'M'
        };
        break;

      case 'JPEG':
        // JPEG como alternativa más ligera
        qrConfig = {
          type: 'image/jpeg',
          quality: 0.9,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          width: 256,
          errorCorrectionLevel: 'M'
        };
        break;

      case 'SVG':
        // SVG para máxima calidad (pero puede causar problemas de compatibilidad)
        qrConfig = {
          type: 'svg',
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          width: 256,
          errorCorrectionLevel: 'M'
        };
        break;

      default:
        // PNG por defecto (más compatible)
        qrConfig = {
          type: 'image/png',
          quality: 0.92,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          width: 256,
          errorCorrectionLevel: 'M'
        };
    }

    qrImage = await QRCode.toDataURL(qrString, qrConfig);

    return {
      image: qrImage,
      format: format.toUpperCase(),
      mimeType: qrConfig.type,
      size: `${qrConfig.width}x${qrConfig.width}`,
      config: qrConfig
    };

  } catch (error) {
    logger.error('Error generating optimal QR', { error: error.message, format });

    // Fallback a PNG básico si falla el formato especificado
    try {
      const fallbackQR = await QRCode.toDataURL(qrString, {
        type: 'image/png',
        width: 256,
        margin: 1
      });

      return {
        image: fallbackQR,
        format: 'PNG',
        mimeType: 'image/png',
        size: '256x256',
        config: { type: 'image/png', width: 256, margin: 1 },
        fallback: true
      };
    } catch (fallbackError) {
      throw new Error(`Failed to generate QR in any format: ${error.message}`);
    }
  }
}

// API Pública
export default {
  async requestQR(userId) {
    if (connectionState.isConnecting || connectionState.isReconnecting) {
      logger.warn('Ignoring QR request: A connection attempt is already in progress.', { userId });
      throw {
        code: 'CONNECTION_IN_PROGRESS',
        message: 'Ya se está intentando conectar o reconectar. Por favor, espera unos segundos.'
      };
    }

    logger.info('Processing new QR request', { userId });

    try {
      // ... (Si está conectado, si hay QR activo, etc. se queda igual) ...
      if (connectionState.socket?.user) { /* ... */ }
      if (connectionState.qrData && Date.now() < connectionState.qrData.expiresAt) { /* ... */ }
      // ... (Rate limiting se queda igual) ...

      connectionState.isConnecting = true; // <-- Bloqueo
      connectionState.connectionStatus = 'connecting';
      connectionState.reconnectAttempts = 0; // Reiniciar contador en solicitud MANUAL

      try {
        await cleanupConnection();
      } catch (cleanupError) {
        logger.error('Error during cleanup', { error: cleanupError.message });
      }

      try {
        connectionState.socket = await createNewSession();
      } catch (sessionError) {
        logger.error('Error creating new session', { error: sessionError.message });
        throw {
          code: 'SESSION_ERROR',
          message: 'Error al crear nueva sesión',
          error: sessionError.message
        };
      }

      connectionState.userConnections.set(userId, [...userHistory, now].slice(-10));

      return {
        success: true,
        message: `Solicitud de QR procesada. El QR se generará automáticamente.`,
        status: 'processing'
      };
    } catch (error) {
      logger.error('Error generating QR', {
        userId,
        error: error.message,
        code: error.code,
        stack: error.stack
      });

      try {
        // Solo liberar el bloqueo si el error NO fue el guardián
        if (error.code !== 'CONNECTION_IN_PROGRESS') {
          connectionState.isConnecting = false;
          connectionState.connectionStatus = 'disconnected';
        }
      } catch (resetError) {
        logger.error('Error resetting state', { error: resetError.message });
      }

      throw error;
    }
  },

  async expireQR(reason, userId) {
    logger.info('Expiring QR code', { reason, userId });

    if (connectionState.qrData) {
      connectionState.qrData.expiresAt = Date.now();
      this.updateQrStatus();
      return true;
    }
    return false;
  },

  getQRStatus() {
    return getQRStatus();
  },

  async sendLeadMessage({ phone, name, categoria }) {
    if (!connectionState.socket?.user) {
      throw new Error('No conectado a WhatsApp. Por favor, escanea el código QR primero.');
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      throw new Error('El número de teléfono debe tener entre 10 y 15 dígitos');
    }

    const formattedPhone = `${cleanPhone}@s.whatsapp.net`;

    const messageText = getLeadTemplate("lead", {
      nombre: name,
      categoria,
    });

    if (!messageText) {
      throw new Error('Plantilla de mensaje no válida');
    }

    try {
      logger.info('Enviando mensaje WhatsApp', {
        phone: formattedPhone,
        template: "lead",
        name,
        categoria,
        messageLength: messageText.length
      });

      const result = await this.sendMessageWithRetry(formattedPhone, messageText);

      logger.info('Mensaje enviado exitosamente', {
        phone: formattedPhone,
        messageId: result.key.id,
        timestamp: new Date().toISOString()
      });

      const sentMessage = {
        phone: formattedPhone,
        template: "lead",
        name,
        categoria,
        messageId: result.key.id,
        sentAt: new Date().toISOString(),
        messagePreview: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''),
        status: 'sent'
      };

      connectionState.sentMessages.push(sentMessage);

      const config = getWhatsAppConfig();
      if (connectionState.sentMessages.length > (config.messages?.maxHistorySize || 100)) {
        connectionState.sentMessages = connectionState.sentMessages.slice(-(config.messages?.maxHistorySize || 100));
      }

      return {
        success: true,
        messageId: result.key.id,
        phone: formattedPhone,
        template: "lead",
        sentAt: new Date().toISOString(),
        messagePreview: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : '')
      };

    } catch (error) {
      logger.error('Error enviando mensaje WhatsApp', {
        phone: formattedPhone,
        error: error.message,
        stack: error.stack
      });

      if (error.message.includes('disconnected')) {
        await cleanupConnection();
        throw new Error('Conexión perdida con WhatsApp. Por favor, escanea el código QR nuevamente.');
      }

      if (error.message.includes('not-authorized')) {
        throw new Error('No tienes autorización para enviar mensajes a este número.');
      }

      if (error.message.includes('forbidden')) {
        throw new Error('No se puede enviar mensajes a este número. Verifica que el número sea válido.');
      }

      if (error.message.includes('rate limit')) {
        throw new Error('Límite de mensajes alcanzado. Espera un momento antes de enviar más mensajes.');
      }

      throw new Error(`Error al enviar mensaje: ${error.message}`);
    }
  },
  async sendMessageNHL({ phone, nombre, mensaje, templateOption }) {
    if (!connectionState.socket?.user) {
      throw new Error('No conectado a WhatsApp. Por favor, escanea el código QR primero.');
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      throw new Error('El número de teléfono debe tener entre 10 y 15 dígitos');
    }

    const formattedPhone = `${cleanPhone}@s.whatsapp.net`;

    const messageText = getTemplateNHL(templateOption, {
      nombre,
      mensaje
    });

    if (!messageText) {
      throw new Error('Plantilla de mensaje no válida');
    }

    try {
      logger.info('Enviando mensaje WhatsApp', {
        phone: formattedPhone,
        template: templateOption,
        nombre,
        mensaje,
        messageLength: messageText.length
      });

      const result = await this.sendMessageWithRetry(formattedPhone, messageText);

      logger.info('Mensaje enviado exitosamente', {
        phone: formattedPhone,
        messageId: result.key.id,
        timestamp: new Date().toISOString()
      });

      const sentMessage = {
        phone: formattedPhone,
        template: templateOption,
        nombre,
        mensaje,
        messageId: result.key.id,
        sentAt: new Date().toISOString(),
        messagePreview: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''),
        status: 'sent'
      };

      connectionState.sentMessages.push(sentMessage);

      const config = getWhatsAppConfig();
      if (connectionState.sentMessages.length > (config.messages?.maxHistorySize || 100)) {
        connectionState.sentMessages = connectionState.sentMessages.slice(-(config.messages?.maxHistorySize || 100));
      }

      return {
        success: true,
        messageId: result.key.id,
        phone: formattedPhone,
        template: templateOption,
        sentAt: new Date().toISOString(),
        messagePreview: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : '')
      };

    } catch (error) {
      logger.error('Error enviando mensaje WhatsApp', {
        phone: formattedPhone,
        error: error.message,
        stack: error.stack
      });

      if (error.message.includes('disconnected')) {
        await cleanupConnection();
        throw new Error('Conexión perdida con WhatsApp. Por favor, escanea el código QR nuevamente.');
      }

      if (error.message.includes('not-authorized')) {
        throw new Error('No tienes autorización para enviar mensajes a este número.');
      }

      if (error.message.includes('forbidden')) {
        throw new Error('No se puede enviar mensajes a este número. Verifica que el número sea válido.');
      }

      if (error.message.includes('rate limit')) {
        throw new Error('Límite de mensajes alcanzado. Espera un momento antes de enviar más mensajes.');
      }

      throw new Error(`Error al enviar mensaje: ${error.message}`);
    }
  },

  async sendMessage({ phone, templateOption, psicologo, fecha, hora, nombre = "", jitsi_url = "" }) {
    if (!connectionState.socket?.user) {
      throw new Error('No conectado a WhatsApp. Por favor, escanea el código QR primero.');
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      throw new Error('El número de teléfono debe tener entre 10 y 15 dígitos');
    }

    const formattedPhone = `${cleanPhone}@s.whatsapp.net`;

    const messageText = getTemplate(templateOption, {
      nombre,
      jitsi_url,
      nombrePsicologo: psicologo,
      fecha,
      hora
    });

    if (!messageText) {
      throw new Error('Plantilla de mensaje no válida');
    }

    try {
      logger.info('Enviando mensaje WhatsApp', {
        phone: formattedPhone,
        template: templateOption,
        psicologo,
        fecha,
        hora,
        nombre,
        hasJitsi: !!jitsi_url,
        messageLength: messageText.length
      });

      const result = await this.sendMessageWithRetry(formattedPhone, messageText);

      logger.info('Mensaje enviado exitosamente', {
        phone: formattedPhone,
        messageId: result.key.id,
        timestamp: new Date().toISOString()
      });

      const sentMessage = {
        phone: formattedPhone,
        template: templateOption,
        psicologo,
        fecha,
        hora,
        // ✅ NUEVO (para historial)
        nombre,
        jitsi_url,
        messageId: result.key.id,
        sentAt: new Date().toISOString(),
        messagePreview: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''),
        status: 'sent'
      };

      connectionState.sentMessages.push(sentMessage);

      const config = getWhatsAppConfig();
      if (connectionState.sentMessages.length > (config.messages?.maxHistorySize || 100)) {
        connectionState.sentMessages = connectionState.sentMessages.slice(-(config.messages?.maxHistorySize || 100));
      }

      return {
        success: true,
        messageId: result.key.id,
        phone: formattedPhone,
        template: templateOption,
        sentAt: new Date().toISOString(),
        messagePreview: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : '')
      };

    } catch (error) {
      logger.error('Error enviando mensaje WhatsApp', {
        phone: formattedPhone,
        error: error.message,
        stack: error.stack
      });

      if (error.message.includes('disconnected')) {
        await cleanupConnection();
        throw new Error('Conexión perdida con WhatsApp. Por favor, escanea el código QR nuevamente.');
      }

      if (error.message.includes('not-authorized')) {
        throw new Error('No tienes autorización para enviar mensajes a este número.');
      }

      if (error.message.includes('forbidden')) {
        throw new Error('No se puede enviar mensajes a este número. Verifica que el número sea válido.');
      }

      if (error.message.includes('rate limit')) {
        throw new Error('Límite de mensajes alcanzado. Espera un momento antes de enviar más mensajes.');
      }

      throw new Error(`Error al enviar mensaje: ${error.message}`);
    }
  },


  async sendMessageWithImage({ imageData, phone, caption }) {
    if (!connectionState.socket?.user) {
      throw new Error('No conectado a WhatsApp. Por favor, escanea el código QR primero.');
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      throw new Error('El número de teléfono debe tener entre 10 y 15 dígitos');
    }

    const formattedPhone = `${cleanPhone}@s.whatsapp.net`;

    // Validar datos de imagen
    if (!imageData) {
      throw new Error('Los datos de la imagen son requeridos');
    }

    let imageBuffer;
    try {
      // Remover prefijo data:image si existe
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');

      // Validar tamaño de imagen (máximo 16MB para WhatsApp)
      const maxSize = 16 * 1024 * 1024; // 16MB
      if (imageBuffer.length > maxSize) {
        throw new Error('La imagen es demasiado grande. El tamaño máximo es 16MB');
      }
    } catch (error) {
      throw new Error('Formato de imagen base64 inválido');
    }

    try {
      const captionText = caption || 'Imagen enviada';
      logger.info('Enviando mensaje con imagen WhatsApp', {
        phone: formattedPhone,
        imageSize: imageBuffer.length,
        captionLength: captionText.length
      });

      // Preparar mensaje con imagen
      const messageOptions = {
        image: imageBuffer,
        caption: captionText,
        jpegThumbnail: null,
      };

      const result = await connectionState.socket.sendMessage(formattedPhone, messageOptions);

      logger.info('Mensaje enviado exitosamente', {
        phone: formattedPhone,
        messageId: result.key.id,
        timestamp: new Date().toISOString()
      });

      const sentMessage = {
        phone: formattedPhone,
        messageId: result.key.id,
        sentAt: new Date().toISOString(),
        messagePreview: captionText.substring(0, 100) + (captionText.length > 100 ? '...' : ''),
        type: 'image',
        imageSize: imageBuffer.length,
        status: 'sent'
      };

      connectionState.sentMessages.push(sentMessage);

      const config = getWhatsAppConfig();
      if (connectionState.sentMessages.length > (config.messages?.maxHistorySize || 100)) {
        connectionState.sentMessages = connectionState.sentMessages.slice(-(config.messages?.maxHistorySize || 100));
      }

      return {
        success: true,
        messageId: result.key.id,
        phone: formattedPhone,
        sentAt: new Date().toISOString(),
        messagePreview: captionText.substring(0, 100) + (captionText.length > 100 ? '...' : ''),
        type: 'image',
        imageSize: imageBuffer.length
      };

    } catch (error) {
      logger.error('Error enviando mensaje WhatsApp', {
        phone: formattedPhone,
        error: error.message,
        stack: error.stack
      });

      if (error.message.includes('disconnected')) {
        await cleanupConnection();
        throw new Error('Conexión perdida con WhatsApp. Por favor, escanea el código QR nuevamente.');
      }

      if (error.message.includes('not-authorized')) {
        throw new Error('No tienes autorización para enviar mensajes a este número.');
      }

      if (error.message.includes('forbidden')) {
        throw new Error('No se puede enviar mensajes a este número. Verifica que el número sea válido.');
      }

      if (error.message.includes('rate limit')) {
        throw new Error('Límite de mensajes alcanzado. Espera un momento antes de enviar más mensajes.');
      }

      throw new Error(`Error al enviar mensaje: ${error.message}`);
    }
  },

  // Función auxiliar para generar thumbnail (opcional)
  async generateThumbnail(imageBuffer) {
    try {
      // Si tienes sharp instalado, puedes usar esto para generar un thumbnail
      // const sharp = require('sharp');
      // return await sharp(imageBuffer)
      //   .resize(100, 100, { fit: 'cover' })
      //   .jpeg({ quality: 50 })
      //   .toBuffer();

      // Si no tienes sharp, puedes retornar null o el buffer original redimensionado
      return null;
    } catch (error) {
      logger.warn('Error generando thumbnail', { error: error.message });
      return null;
    }
  },

  // Función auxiliar mejorada para sendMessageWithRetry si no existe
  async sendMessageImageWithRetry(jid, content, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`Intento ${attempt} de envío de mensaje`, { jid, attempt, maxRetries });

        const result = await connectionState.socket.sendMessage(jid, content);

        if (result) {
          logger.debug('Mensaje enviado exitosamente', { jid, attempt, messageId: result.key?.id });
          return result;
        }
      } catch (error) {
        lastError = error;
        logger.warn(`Error en intento ${attempt}`, {
          jid,
          attempt,
          maxRetries,
          error: error.message
        });

        // Si es el último intento, no esperar
        if (attempt === maxRetries) {
          break;
        }

        // Esperar antes del siguiente intento (backoff exponencial)
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s...
        logger.debug(`Esperando ${delay}ms antes del siguiente intento`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Error desconocido al enviar mensaje');
  },

  async sendMessageWithRetry(phone, messageText, maxRetries = null) {
    const config = getWhatsAppConfig();
    const retries = maxRetries || config.messages?.maxRetries || 3;
    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await connectionState.socket.sendMessage(phone, {
          text: messageText,
          timestamp: Date.now()
        });
        return result;
      } catch (error) {
        lastError = error;
        logger.warn(`Intento ${attempt} fallido al enviar mensaje`, {
          phone,
          error: error.message,
          attempt
        });

        if (attempt < retries) {
          const delay = Math.min((config.messages?.retryDelay || 2000) * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  },

  getQrCode() {
    const now = Date.now();

    if (!connectionState.qrData || now >= connectionState.qrData.expiresAt) {
      return null;
    }

    const timeRemaining = Math.floor((connectionState.qrData.expiresAt - now) / 1000);

    return {
      ...connectionState.qrData,
      timeRemaining,
      timeRemainingFormatted: `${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, '0')}`,
      percentageRemaining: Math.round((timeRemaining / 60) * 100),
      isExpired: false,
      age: Math.floor((now - new Date(connectionState.qrData.createdAt).getTime()) / 1000)
    };
  },

  updateQrStatus() {
    const status = this.getQRStatus();
    emitQrStatusUpdate(status);
  },

  getSentMessages() {
    return connectionState.sentMessages.slice().reverse();
  },

  clearSentMessages() {
    connectionState.sentMessages = [];
    logger.info('Historial de mensajes enviados limpiado');
    return true;
  },

  // Nuevo método para forzar reconexión manual
  async forceReconnect() {
    logger.info('Forcing manual reconnection');
    connectionState.reconnectAttempts = 0;
    connectionState.isReconnecting = false;
    await attemptReconnect();
  },

  // Método para obtener estado de reconexión
  getReconnectionStatus() {
    return {
      isReconnecting: connectionState.isReconnecting,
      reconnectAttempts: connectionState.reconnectAttempts,
      maxReconnectAttempts: connectionState.maxReconnectAttempts,
      lastConnectionAttempt: connectionState.lastConnectionAttempt
    };
  },

  // Método para generar QR en formato específico
  async generateQRInFormat(qrString, format = 'PNG') {
    try {
      const qrResult = await generateOptimalQR(qrString, format);
      logger.info('QR generated in specific format', {
        format: qrResult.format,
        size: qrResult.size,
        mimeType: qrResult.mimeType
      });
      return qrResult;
    } catch (error) {
      logger.error('Error generating QR in specific format', { error: error.message, format });
      throw error;
    }
  },

  // Método para obtener información del formato del QR actual
  getQRFormatInfo() {
    if (!connectionState.qrData) {
      return null;
    }

    return {
      format: connectionState.qrData.format,
      size: connectionState.qrData.size,
      mimeType: connectionState.qrData.mimeType,
      fallback: connectionState.qrData.fallback || false,
      createdAt: connectionState.qrData.createdAt,
      expiresAt: connectionState.qrData.expiresAt
    };
  },

  // Método para cambiar formato del QR actual
  async changeQRFormat(format) {
    try {
      if (!connectionState.qrData?.qrString) {
        throw new Error('No hay QR activo para cambiar formato');
      }

      const qrResult = await generateOptimalQR(connectionState.qrData.qrString, format);

      // Actualizar el QR existente con el nuevo formato
      connectionState.qrData = {
        ...connectionState.qrData,
        image: qrResult.image,
        format: qrResult.format,
        size: qrResult.size,
        mimeType: qrResult.mimeType,
        fallback: qrResult.fallback || false
      };

      // Emitir actualización
      try {
        emitQrStatusUpdate(getQRStatus());
      } catch (emitError) {
        logger.error('Error emitting QR format change', { error: emitError.message });
      }

      logger.info('QR format changed successfully', {
        newFormat: qrResult.format,
        size: qrResult.size,
        mimeType: qrResult.mimeType
      });

      return qrResult;
    } catch (error) {
      logger.error('Error changing QR format', { error: error.message, format });
      throw error;
    }
  },

  // Método para enviar mensajes simples (aceptación/rechazo)
  async sendSimpleMessage({ phone, message, type, useTemplate = false }) {
    if (!connectionState.socket?.user) {
      throw new Error('No conectado a WhatsApp. Por favor, escanea el código QR primero.');
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      throw new Error('El número de teléfono debe tener entre 10 y 15 dígitos');
    }

    const formattedPhone = `${cleanPhone}@s.whatsapp.net`;

    // Importar las funciones de template
    const { getAcceptanceTemplate, getRejectionTemplate } = await import('../templates.js');

    let finalMessage = message;

    // Si se debe usar template, aplicar el correspondiente según el tipo
    if (useTemplate) {
      if (type === 'accept') {
        finalMessage = getAcceptanceTemplate(message);
      } else if (type === 'reject') {
        finalMessage = getRejectionTemplate(message);
      }
    }

    try {
      logger.info('Enviando mensaje simple WhatsApp', {
        phone: formattedPhone,
        type: type,
        useTemplate: useTemplate,
        messageLength: finalMessage.length
      });

      const result = await this.sendMessageWithRetry(formattedPhone, finalMessage);

      logger.info('Mensaje simple enviado exitosamente', {
        phone: formattedPhone,
        type: type,
        useTemplate: useTemplate,
        messageId: result.key.id,
        timestamp: new Date().toISOString()
      });

      const sentMessage = {
        phone: formattedPhone,
        type: type,
        message: message, // Guardar el comentario original
        finalMessage: finalMessage, // Guardar el mensaje final con template
        useTemplate: useTemplate,
        messageId: result.key.id,
        sentAt: new Date().toISOString(),
        messagePreview: finalMessage.substring(0, 100) + (finalMessage.length > 100 ? '...' : ''),
        status: 'sent'
      };

      connectionState.sentMessages.push(sentMessage);

      const config = getWhatsAppConfig();
      if (connectionState.sentMessages.length > (config.messages?.maxHistorySize || 100)) {
        connectionState.sentMessages = connectionState.sentMessages.slice(-(config.messages?.maxHistorySize || 100));
      }

      return {
        success: true,
        messageId: result.key.id,
        phone: formattedPhone,
        type: type,
        useTemplate: useTemplate,
        sentAt: new Date().toISOString(),
        messagePreview: finalMessage.substring(0, 100) + (finalMessage.length > 100 ? '...' : ''),
        originalComment: message
      };

    } catch (error) {
      logger.error('Error enviando mensaje simple WhatsApp', {
        phone: formattedPhone,
        type: type,
        useTemplate: useTemplate,
        error: error.message,
        stack: error.stack
      });

      if (error.message.includes('disconnected')) {
        await cleanupConnection();
        throw new Error('Conexión perdida con WhatsApp. Por favor, escanea el código QR nuevamente.');
      }

      if (error.message.includes('not-authorized')) {
        throw new Error('No tienes autorización para enviar mensajes a este número.');
      }

      if (error.message.includes('forbidden')) {
        throw new Error('No se puede enviar mensajes a este número. Verifica que el número sea válido.');
      }

      if (error.message.includes('rate limit')) {
        throw new Error('Límite de mensajes alcanzado. Espera un momento antes de enviar más mensajes.');
      }

      throw new Error(`Error al enviar mensaje: ${error.message}`);
    }
  },



  async getImageBase64(imgPath) {
    try {
      if (imgPath.startsWith("http")) {
        const response = await fetch(imgPath);
        if (!response.ok) throw new Error(`HTTP ${response.status} al descargar ${imgPath}`);
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer).toString("base64");
      } else {
        return fs.readFileSync(path.resolve(imgPath), { encoding: "base64" });
      }
    } catch (error) {
      console.error(`Error obteniendo imagen desde ${imgPath}:`, error.message);
      return null;
    }
  },

  async sendBannerMessage({ phone, name, categoria }) {
    const images = flyers[categoria] || [];

    if (images.length === 0) {
      // fallback: mensaje normal sin banner
      return this.sendLeadMessage({ phone, name, categoria });
    }

    const caption = `Hola ${name},\n\nGracias por contactarte con NHL Decoraciones.`;

    const firstImageBase64 = await this.getImageBase64(images[0]);

    await this.sendMessageWithImage({
      imageData: firstImageBase64,
      phone,
      caption
    });

    images.slice(1).forEach((img, index) => {
      setTimeout(async () => {
        try {
          const base64ImgData = this.getImageBase64(img)
          await this.sendMessageWithImage({
            imageData: base64ImgData,
            phone,
            caption
          });
        } catch (err) {
          console.error(`Error enviando imagen ${img} a ${phone}`, err);
        }
      }, (index + 1) * 5 * 60 * 1000);
    });

    return { scheduledMessages: images.length, phone, categoria };
  }
};