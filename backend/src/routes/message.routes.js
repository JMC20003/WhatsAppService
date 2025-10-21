import {
  sendMessage,
  getStatus,
  requestNewQr,
  forceExpireQr,
  getQrStatus,
  getQrCode,
  resetAuth,
  getSentMessages,
  checkAuthStatus,
  forceReconnect,
  getReconnectionStatus,
  sendMessageWithImage,
  sendMessageAccept,
  sendMessageReject,
  sendLeadMessage,
  sendMessageNHL2,
  sendMessageNHL3,
  sendLeadMessageWithBanner
} from '../controllers/message.controller.js';
import { 
  validateSendMessage, 
  validateSendImage, 
  validateSendMessageAccept, 
  validateSendMessageReject 
} from '../validators/message.validator.js';
import { authenticateJWT, authorizeRole, apiKeyAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';
import uploadFlyer from '../middlewares/upload.middleware.js';
import fs from 'fs';

function authFlex(req, res, next) {
  if (req.headers["x-api-key"]) {
    return apiKeyAuth(req, res, next);
  }
  return authenticateJWT(req, res, (err) => {
    if (err) return res.status(401).json({ success: false, message: "No autorizado" });
    return authorizeRole("admin")(req, res, next);
  });
}

const router = Router();

//router.post('/send-messageNHL', authFlex, sendMessageNHL2);//Nuestro
router.post('/send-messageNHL', authFlex, uploadFlyer, sendMessageNHL3);//Nuestro
router.post('/send-message', authFlex, validateSendMessage, sendMessage);
router.post('/send-lead-message', authFlex,  sendLeadMessage); //Nuestro
router.post('/send-lead-message-image', authFlex, sendLeadMessageWithBanner); //Nuestro con imagen
router.post('/send-message-accept', validateSendMessageAccept, sendMessageAccept);
router.post('/send-message-reject', validateSendMessageReject, sendMessageReject);
router.get('/sent-messages', getSentMessages);
router.get('/qr-code', authenticateJWT, authorizeRole('admin'), getQrCode);
router.post('/send-image', validateSendImage, sendMessageWithImage);
router.get('/status', authenticateJWT, getStatus);
router.get('/qr-status', authenticateJWT, getQrStatus);
router.get('/auth-status', authenticateJWT, checkAuthStatus);
router.get('/reconnection-status', authenticateJWT, getReconnectionStatus);
router.post('/qr-request', authenticateJWT, authorizeRole('admin'), requestNewQr);
router.post('/qr-expire', authenticateJWT, authorizeRole('admin'), forceExpireQr);
router.post('/auth/reset', authenticateJWT, authorizeRole('admin'), resetAuth);
router.post('/force-reconnect', authenticateJWT, authorizeRole('admin'), forceReconnect);

export default router;