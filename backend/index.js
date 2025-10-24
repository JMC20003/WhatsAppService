import 'dotenv/config';
import { server } from './src/app.js';
import { AUTH_CONFIG } from './src/config/auth.config.js';

import dotenv from "dotenv";
dotenv.config();


const PORT = process.env.PORT || 5111;

// Validar configuración de autenticación
AUTH_CONFIG.validateConfig();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor WhatsApp corriendo en http://0.0.0.0:${PORT}`);
});