FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Crear la carpeta de sesión dentro del contenedor
RUN mkdir -p /app/auth_info && chmod -R 775 /app

# Expone el puerto definido en .env o por defecto 5111
EXPOSE 5111
CMD ["node", "index.js"]