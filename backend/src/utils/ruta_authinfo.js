import fs from "fs";
import path from "path";
import logger from './logger.js';

const authPathInfo = () => {
    const ruta = path.resolve("./auth_info");
    try {
        if (!fs.existsSync(ruta)) {
            logger.info('Creando carpeta auth_info en:', ruta);
            fs.mkdirSync(ruta, { recursive: true, mode: 0o775 });
        }
        // Verificar que podemos escribir en la carpeta
        fs.accessSync(ruta, fs.constants.W_OK);
        logger.info('Carpeta auth_info lista y accesible');
    } catch (error) {
        logger.error('Error al crear/acceder a auth_info:', { error: error.message, ruta });
        throw new Error(`No se puede acceder a la carpeta auth_info: ${error.message}`);
    }
    return ruta;
}

export default authPathInfo;