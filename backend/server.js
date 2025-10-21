import { DisconnectReason, makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';
import cors from 'cors';
import express from 'express';
import qrcode from 'qrcode-terminal';
import { getTemplate } from './src/templates.js';
import authPathInfo from "./src/utils/ruta_authinfo.js";

const app = express();
app.use(cors());
app.use(express.json());

let sock;
let isConnected = false;
let waitingForScan = false;
let reconnecTimeOut;

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(authPathInfo());

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      waitingForScan = true;
      console.log('Escanea este QR con WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      if (waitingForScan) return;

      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Conexión cerrada. Reconectando...', shouldReconnect);
      if (shouldReconnect || lastDisconnect?.error?.message?.includes('identity changed')) {
        connectToWhatsApp();
      }
      isConnected = false;
    } else if (connection === 'open') {
      waitingForScan = false;
      console.log('¡Conectado a WhatsApp!');
      isConnected = true;
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

// API endpoint para enviar mensajes
app.post('/send-message', async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(503).json({
        success: false,
        message: 'WhatsApp no está conectado'
      });
    }

    const { phone, templateOption, psicologo, fecha, hora } = req.body;

    if (!phone || !templateOption) {
      return res.status(400).json({
        success: false,
        message: 'Teléfono o plantilla no proporcionado'
      });
    }

    // Formatear número (agregar código de país si no lo tiene)
    let formattedPhone = phone.replace(/[^\d]/g, '');
    if (formattedPhone.length < 8) { // Para Perú
      return res.status(400).json({
        success: false,
        message: 'El número de teléfono debe estar en formato internacional, ej: +51987654321'
      });
    }
    formattedPhone += '@s.whatsapp.net';

    const plantilla = getTemplate(templateOption, { nombrePsicologo: psicologo, fecha, hora });

    const result = await sock.sendMessage(formattedPhone, { text: plantilla });

    res.json({
      success: true,
      message: 'Mensaje enviado correctamente',
      messageId: result.key.id
    });

  } catch (error) {
    console.error('Error enviando mensaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// Endpoint para verificar estado de conexión
app.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5111;
app.listen(PORT, () => {
  console.log(`Servidor WhatsApp corriendo en puerto ${PORT}`);
  connectToWhatsApp();
});