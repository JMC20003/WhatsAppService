import whatsappService from "../services/whatsapp.service.js";
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
import { getTemplateNHL } from '../templates.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function sendMessage(req, res) {
  try {
    const { phone, templateOption, psicologo, fecha, hora } = req.body;

    // Validaciones adicionales
    if (!phone || !templateOption || !psicologo || !fecha || !hora) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos requeridos",
        required: ["phone", "templateOption", "psicologo", "fecha", "hora"],
      });
    }

    const result = await whatsappService.sendMessage({
      phone,
      templateOption,
      psicologo,
      fecha,
      hora,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error en sendMessage:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function sendMessageNHL(req, res) {
  try {
    const { phone, nombre, mensaje, templateOption } = req.body;

    // Validaciones adicionales
    if (!phone || !nombre || !mensaje || !templateOption) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos requeridos",
        required: ["phone", "nombre", "mensaje", "templateOption"],
      });
    }

    const result = await whatsappService.sendMessageNHL({
      phone,
      nombre,
      mensaje,
      templateOption,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error en sendMessage:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function sendMessageNHL3(req, res) {
  try {
    const { phone, nombre, mensaje } = req.body; // campos de texto

    // Validaciones mínimas
    if (!phone || !nombre || !mensaje) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos requeridos",
        required: ["phone", "nombre", "mensaje", "flyer (archivo)"],
      });
    }

    // Armamos el texto/caption
    const caption = `👋 Hola ${nombre}, te saluda NHL Decoración Comercial.

💬 Mensaje: ${mensaje}`;

    // Si hay archivo (subido desde front)
    if (req.file) {
      const flyerFile = {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        buffer: req.file.buffer, // viene en memoria porque usamos memoryStorage
      };

      // Convertimos el buffer a base64
      const imageData = flyerFile.buffer.toString('base64');

      // Enviar al servicio de WhatsApp con imagen
      const result = await whatsappService.sendMessageWithImage({
        phone,
        imageData,
        caption,
      });

      return res.json({
        success: true,
        message: `Mensaje con imagen enviado exitosamente a ${phone}`,
        ...result,
      });
    }

    // Si no hay archivo -> envía solo texto
    const result = await whatsappService.sendLeadMessage({
      phone,
      name: nombre,
      categoria: 'mensaje_simple',
      mensaje,
    });

    return res.json({
      success: true,
      message: `Mensaje enviado sin imagen a ${phone}`,
      ...result,
    });
  } catch (error) {
    console.error("Error en sendMessageNHL2:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function sendMessageNHL2(req, res) {
  try {
    const { phone, nombre, mensaje, templateOption } = req.body;

    if (!phone || !nombre || !mensaje || !templateOption) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos requeridos",
        required: ["phone", "nombre", "mensaje", "templateOption"],
      });
    }

    // Aquí generas el texto y la ruta
    const { text, imagePath } = getTemplateNHL(templateOption, {
      nombre,
      telefono: phone,
      mensaje,
    });

    // Validar que exista la imagen
    if (!fs.existsSync(imagePath)) {
      console.error("Imagen no encontrada:", imagePath);

      // si no existe la imagen envía solo texto
      const result = await whatsappService.sendLeadMessage({
        phone,
        name: nombre,
        categoria: templateOption,
      });

      return res.status(200).json({
        success: true,
        message: `No hay imagen configurada para la plantilla: ${templateOption}, enviando mensaje normal`,
        ...result,
      });
    }

    // Leer archivo como base64
    const imageData = fs.readFileSync(imagePath, { encoding: "base64" });

    // Caption = tu texto generado
    const caption = text;

    // Enviar al servicio de WhatsApp
    const result = await whatsappService.sendMessageWithImage({
      phone,
      imageData,
      caption,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error en sendMessageNHL:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function sendLeadMessage(req, res) {
  try {
    const { phone, name, categoria } = req.body;

    // Validaciones adicionales
    if (!phone || !name || !categoria) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos requeridos",
        required: ["phone", "name", "categoria"],
      });
    }

    const result = await whatsappService.sendLeadMessage({
      phone,
      name,
      categoria
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error en sendMessage:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export function getStatus(req, res) {
  try {
    res.json({
      success: true,
      connected: whatsappService.isConnected(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error en getStatus:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo estado",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export function getQrStatus(req, res) {
  try {
    const qrStatus = whatsappService.getQRStatus();
    res.json({
      success: true,
      ...qrStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error en getStatus:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo estado",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function startConnection(req, res) {
  try {
    console.log(
      `🔌 Usuario ${req.user.username} solicitando inicio de conexión`,
    );

    const result = await whatsappService.startConnection();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        alreadyConnected: result.alreadyConnected || false,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        success: false,
        message: result.message,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Error al iniciar conexión:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor al iniciar conexión",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export function getQrCode(req, res) {
  try {
    const qrData = whatsappService.getQrCode();

    if (qrData) {
      return res.json({
        success: true,
        ...qrData,
        message: `QR válido por ${qrData.timeRemaining} segundos más`,
      });
    }

    return res.status(404).json({
      success: false,
      message:
        "No hay QR disponible. Solicita uno nuevo con POST /api/qr-request",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error en getQrCode:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo QR",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function requestNewQr(req, res) {
  try {
    const userId = req.user.userId;
    console.log(`📱 Usuario ${userId} solicitando nuevo QR`);

    const result = await whatsappService.requestQR(userId);

    if (result.success) {
      // Obtener el estado actual después de procesar la solicitud
      const currentStatus = whatsappService.getQRStatus();

      res.json({
        success: true,
        message: result.message,
        status: result.status,
        currentStatus: currentStatus,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Mapear códigos de estado apropiados
      const statusCodeMap = {
        QR_ACTIVE: 409, // Conflict
        RATE_LIMIT_EXCEEDED: 429, // Too Many Requests
        TOO_FREQUENT: 429, // Too Many Requests
        ALREADY_CONNECTED: 409, // Conflict
        CONNECTION_ERROR: 503, // Service Unavailable
        QR_REQUEST_ERROR: 500, // Internal Server Error
      };

      const statusCode = statusCodeMap[result.reason] || 400;

      res.status(statusCode).json({
        success: false,
        reason: result.reason,
        message: result.message,
        ...(result.timeRemaining && { timeRemaining: result.timeRemaining }),
        ...(result.timeToWait && { timeToWait: result.timeToWait }),
        ...(result.timeUntilReset && { timeUntilReset: result.timeUntilReset }),
        ...(result.error && { error: result.error }),
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error al solicitar nuevo QR:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export function getQrStats(req, res) {
  try {
    const userId = req.user.userId;
    const stats = whatsappService.getQrStats(userId);

    res.json({
      success: true,
      userId,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error al obtener estadísticas de QR:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export function forceExpireQr(req, res) {
  try {
    const userId = req.user.username;
    console.log(`🗑️ Usuario ${userId} forzando expiración de QR`);

    const result = whatsappService.expireQR("admin_request", userId);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error al forzar expiración de QR:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

// Función adicional para obtener información detallada del estado de conexión
export function getConnectionInfo(req, res) {
  try {
    const status = whatsappService.getQrStatus();
    const isConnected = whatsappService.isConnected();

    res.json({
      success: true,
      connectionDetails: {
        isConnected,
        status: status.status,
        message: status.message,
        connectionState: status.connectionState,
        qrAvailable: !!whatsappService.getQrCode(),
        qrTimeRemaining: status.timeRemaining || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error obteniendo información de conexión:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo información de conexión",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

// Función para reiniciar completamente la conexión (solo admin)
export async function restartConnection(req, res) {
  try {
    const userId = req.user.username;
    console.log(
      `🔄 Usuario ${userId} solicitando reinicio completo de conexión`,
    );

    // Limpiar conexión actual
    await whatsappService.cleanup();

    // Esperar un poco antes de reiniciar
    setTimeout(async () => {
      try {
        const result = await whatsappService.startConnection();
        console.log(`✅ Conexión reiniciada por ${userId}: ${result.message}`);
      } catch (error) {
        console.error(`❌ Error reiniciando conexión para ${userId}:`, error);
      }
    }, 2000);

    res.json({
      success: true,
      message: "Reinicio de conexión iniciado",
      note: "La conexión se está reiniciando en segundo plano",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error al reiniciar conexión:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export function resetAuth(req, res) {
  try {
    const authPath = path.resolve(__dirname, '..', '..', 'auth_info');

    // Verificar que sea un directorio
    const stats = fs.statSync(authPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({
        success: false,
        message: 'La ruta auth_info no es un directorio',
        timestamp: new Date().toISOString(),
      });
    }

    // Eliminar la carpeta de forma recursiva
    fs.rm(authPath, { recursive: true, force: true }, (err) => {
      if (err) {
        console.error(`Error eliminando la carpeta ${authPath}:`, err);
        return res.status(500).json({
          success: false,
          message: 'Error al eliminar la carpeta auth_info',
          error: err.message,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log(`Carpeta ${authPath} eliminada correctamente.`);
        return res.json({
          success: true,
          message: 'Carpeta auth_info eliminada correctamente',
          timestamp: new Date().toISOString(),
        });
      }
    });
  } catch (error) {
    console.error('Error en resetAuth:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

// Función para obtener historial de mensajes enviados
export function getSentMessages(req, res) {
  try {
    const sentMessages = whatsappService.getSentMessages();

    res.json({
      success: true,
      messages: sentMessages,
      total: sentMessages.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error obteniendo historial de mensajes:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo historial de mensajes",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

// Función para verificar el estado de la carpeta auth_info
export function checkAuthStatus(req, res) {
  try {
    const authPath = path.resolve(__dirname, '..', '..', 'auth_info');
    const authExists = fs.existsSync(authPath);

    let authDetails = null;
    if (authExists) {
      try {
        const stats = fs.statSync(authPath);
        authDetails = {
          exists: true,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          path: authPath
        };
      } catch (error) {
        authDetails = {
          exists: true,
          error: error.message
        };
      }
    }

    res.json({
      success: true,
      path: authPath,
      authStatus: {
        exists: authExists,
        details: authDetails
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error verificando estado de auth:", error);
    res.status(500).json({
      success: false,
      message: "Error verificando estado de auth",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

// Función para forzar reconexión manual
export async function forceReconnect(req, res) {
  try {
    const userId = req.user.id;
    console.log('Usuario solicitando reconexión manual', { userId });

    await whatsappService.forceReconnect();

    res.json({
      success: true,
      message: 'Reconexión iniciada manualmente',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error en reconexión manual', {
      userId: req.user.id,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Error al iniciar reconexión manual',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

// Función para obtener estado de reconexión
export function getReconnectionStatus(req, res) {
  try {
    const status = whatsappService.getReconnectionStatus();

    res.json({
      success: true,
      reconnectionStatus: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error obteniendo estado de reconexión', { error: error.message });

    res.status(500).json({
      success: false,
      message: 'Error al obtener estado de reconexión',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function sendLeadMessageWithBanner(req, res) {
  try {
    const { phone, name, categoria } = req.body;

    if (!phone || !name || !categoria) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos requeridos",
        required: ["phone", "name", "categoria"],
      });
    }

    /* // Mapeo de categoría → archivo de banner
    const banners = {
      "Diseño de interiores para Cevichería moderna": "./public/img/flyers/Cevicheria-Flyer-2.webp",
      "Sanguchería urbana con estilo visual": "./public/img/flyers/Sangucheria-Flyer-2.webp",
      "Discoteca con ambientación LED y branding": "./public/img/flyers/Discoteca-Flyer-2.webp",
      "Pollería funcional con diseño temático": "./public/img/flyers/Polleria-Flyer-2.webp",
      "Restaurante personalizado para experiencia gastronómica": "./public/img/flyers/Restaurante-Flyer-2.webp",
      "Bar con identidad y mobiliario a medida": "./public/img/flyers/Bar-Flyer-2.webp",
      "Fast Food optimizado con flujo eficiente": "./public/img/flyers/FastFood-Flyer-2.webp",
      "Salón Spa con estética relajante y profesional": "./public/img/flyers/SalonSpa-Flyer-2.webp",
      "Diseño interior para Hogares con personalidad": "./public/img/flyers/DisenoInterior-Flyer-2.webp",
      "Pizzería con estilo artesanal y branding cálido": "./public/img/flyers/Pizzeria-Flyer-2.webp",
      "Panaderia": "./public/img/flyers/PanaderiaArtesanal-Flyer-2.webp",
      "Minimarket": "./public/img/flyers/Minimarket-Flyer-2.webp",
      "Clinica Dental": "./public/img/flyers/ClinicaDental-Flyer-2.webp",
      "Departamento": "./public/img/flyers/Departamento-Flyer-2.webp",
      "Dormitorio": "./public/img/flyers/Dormitorio-Flyer-2.webp",
      "Estilo Industrial": "./public/img/flyers/EspacioIndustrialUrbano-Flyer-2.webp",
      "Fuente de Soda": "./public/img/flyers/FuenteSoda-Flyer-2.webp",
      "Gimnasio": "./public/img/flyers/Gimnasio-Flyer-2.webp",
      "Hoteles": "./public/img/flyers/Hoteles-Flyer-2.webp",
      "Recepciones": "./public/img/flyers/Recepciones-Flyer-2.webp",
      "Restobar": "./public/img/flyers/Restobar-Flyer-2.webp",
      "Salon Belleza": "./public/img/flyers/SalonBelleza-Flyer-2.webp",
      "Ropa": "./public/img/flyers/TiendaRopa-Flyer-2.webp",
      "Terraza": "./public/img/flyers/Terraza-Flyer-2.webp",
      "Veterinaria": "./public/img/flyers/Veterinaria-Flyer-2.webp",
      "Heladeria": "./public/img/flyers/Heladeria-Flyer-2.webp",
    };

    const bannerFile = banners[categoria];
    
    if (!bannerFile) {
      await whatsappService.sendLeadMessage({
        phone,
        name,
        categoria
      });

      return res.status(200).json({
        success: true,
        message: `No hay banner configurado para la categoría: ${categoria}, enviando mensaje normal`,
      });
    }

    // Ruta del archivo
    const imagePath = path.resolve(`${bannerFile}`);

    // Leer archivo como base64
    const imageData = fs.readFileSync(imagePath, { encoding: "base64" });

    // Mensaje dinámico
    const caption = `Hola ${name},\n\nGracias por contactarte con NHL Decoraciones.`;

    // Enviar al servicio de WhatsApp
    const result = await whatsappService.sendMessageWithImage({
      phone,
      imageData,
      caption,
    });

    res.json({
      success: true,
      ...result,
    }); */

    const result = await whatsappService.sendBannerMessage({ phone, name, categoria });

    return res.status(200).json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error("Error en sendLeadMessageWithBanner:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}


// Funcion para enviar mensajes con imagenes
export async function sendMessageWithImage(req, res) {
  try {
    const { imageData, phone, caption } = req.body;

    // Validaciones adicionales
    if (!phone || !imageData) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos requeridos",
        required: ["imageData", "phone"],
      });
    }

    // Validar formato del teléfono
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return res.status(400).json({
        success: false,
        message: "El número de teléfono debe tener entre 10 y 15 dígitos",
      });
    }

    const result = await whatsappService.sendMessageWithImage({
      imageData,
      phone,
      caption: caption || 'Imagen enviada',
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error en sendMessageWithImage:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function sendMessageAccept(req, res) {
  try {
    const { telefono, comentario } = req.body;

    // Validaciones básicas
    if (!telefono || !comentario) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos requeridos",
        required: ["telefono", "comentario"],
      });
    }

    // Validar que el comentario no esté vacío
    if (typeof comentario !== 'string' || comentario.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "El comentario no puede estar vacío",
      });
    }

    const result = await whatsappService.sendSimpleMessage({
      phone: telefono,
      message: comentario,
      type: 'accept',
      useTemplate: true
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error en sendMessageAccept:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function sendMessageReject(req, res) {
  try {
    const { telefono, comentario } = req.body;

    // Validaciones básicas
    if (!telefono || !comentario) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos requeridos",
        required: ["telefono", "comentario"],
      });
    }

    // Validar que el comentario no esté vacío
    if (typeof comentario !== 'string' || comentario.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "El comentario no puede estar vacío",
      });
    }

    const result = await whatsappService.sendSimpleMessage({
      phone: telefono,
      message: comentario,
      type: 'reject',
      useTemplate: true
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error en sendMessageReject:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}