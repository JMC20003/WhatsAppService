import multer from 'multer';

// Guardamos el archivo en memoria, no en disco
const storage = multer.memoryStorage();

// Middleware para subir un solo archivo con nombre del campo 'flyer'
const uploadFlyer = multer({ storage }).single('flyer');

export default uploadFlyer;