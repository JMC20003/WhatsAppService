import fs from "fs";
import path from "path";

const authPathInfo = () => {
    const ruta = path.resolve("./auth_info");
    if (!fs.existsSync(ruta)) {
        fs.mkdirSync(ruta, { recursive: true });
    }
    return ruta;
}

export default authPathInfo;