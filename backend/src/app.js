import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import messageRoutes from './routes/message.routes.js';
import authRoutes from './routes/auth.routes.js';
import jwt from 'jsonwebtoken';
import whatsappService from './services/whatsapp.service.js';
import 'dotenv/config';

// =========================
// CORS: leer múltiples orígenes desde .env
// =========================
const rawAllowedOrigins = process.env.ALLOWED_ORIGINS;
// Si ALLOWED_ORIGINS es "*", permitimos todos en modo "reflejar origen"
const allowAllOrigins = rawAllowedOrigins === '*';

const ALLOWED_ORIGINS = (!rawAllowedOrigins || allowAllOrigins)
  ? ['http://localhost:3000', 'http://localhost:3001'] // fallback en local
  : rawAllowedOrigins.split(',').map(o => o.trim());

console.log('ALLOWED_ORIGINS =>', ALLOWED_ORIGINS, 'allowAllOrigins =>', allowAllOrigins);

const app = express();
app.set('trust proxy', 1); // <-- Para el tema de X-Forwarded-For / rate-limit detrás de proxy

const server = createServer(app);

// =========================
// Socket.IO con CORS
// =========================
const io = new Server(server, {
  cors: allowAllOrigins
    ? {
      origin: true, // refleja el origen que hace la petición
      credentials: true,
      methods: ['GET', 'POST']
    }
    : {
      origin: ALLOWED_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST']
    }
});

app.use(helmet());

// =========================
// CORS para Express
// =========================
if (allowAllOrigins) {
  // Refleja cualquier origen (útil si en algún momento pones ALLOWED_ORIGINS="*")
  app.use(cors({
    origin: true, // refleja el origin
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-api-key']
  }));
} else {
  // Solo los dominios listados en ALLOWED_ORIGINS
  app.use(cors({
    origin: (origin, callback) => {
      // Permitir requests sin origen (Postman, curl, etc.)
      if (!origin) return callback(null, true);

      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`CORS bloqueó el origen: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-api-key']
  }));
}

// Aumentando limite a 50mb
app.use(express.json({
  limit: '50mb'
}));

app.use(express.urlencoded({
  limit: '50mb',
  extended: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Excluir el endpoint qr-status del rate limiting
    return req.path === '/api/qr-status' || req.path === '/api/qr-status/';
  }
});

app.use(limiter);

// Añadir ruta de Health Check para Dokploy
app.get('/health', (req, res) => {
  const status = whatsappService.getQRStatus();
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    connection: status.isConnected ? 'connected' : 'disconnected'
  });
});

// Rutas de autenticación (sin API key)
app.use('/api/auth', authRoutes);

// Rutas de mensajes (con API key)
app.use('/api', messageRoutes);

// WebSocket para QR status
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  // Verificar autenticación del token
  const token = socket.handshake.auth.token;
  if (!token) {
    console.log('Se desconectó porque no hay token');
    socket.disconnect();
    return;
  }

  // Verificar JWT
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('Se desconectó porque la verificación del token es falsa');
      socket.disconnect();
      return;
    }

    // Guardar información del usuario en el socket
    socket.userId = decoded.userId;
    socket.user = decoded;

    // Enviar estado inicial del QR
    const qrStatus = whatsappService.getQRStatus();
    socket.emit('qr-status-update', qrStatus);

    console.log('Usuario autenticado:', decoded.username);
  });

  // Unirse a la sala del usuario
  socket.on('join-user', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`Usuario ${userId} se unió a su sala`);
  });

  // Solicitar estado inicial
  socket.on('get-initial-status', () => {
    const qrStatus = whatsappService.getQRStatus();
    socket.emit('qr-status-update', qrStatus);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.userId);
  });
});

// -> Validando el token por conexión de socket
io.use((socket, next) => {
  const token = socket.handshake?.auth?.token;
  if (!token) return next(new Error('Token requerido'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded?.userId;
    socket.user = decoded;
    next();
  } catch (err) {
    console.error('Token inválido en conexión socket: ', err.message);
    next(new Error('Token inválido o expirado'));
  }
});

// Función para emitir actualizaciones del QR a todos los clientes
export function emitQrStatusUpdate(status) {
  io.emit('qr-status-update', status);
}

// Función para emitir a un usuario específico
export function emitQrStatusToUser(userId, status) {
  io.to(`user-${userId}`).emit('qr-status-update', status);
}

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

export { server, io };
