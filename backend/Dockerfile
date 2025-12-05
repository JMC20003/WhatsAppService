FROM node:22-alpine

# Instala dependencias del sistema necesarias para TLS y depuración de red
RUN apk add --no-cache \
    ca-certificates \
    curl \
    bash \
    tzdata \
    tini

# (Opcional) Verifica que los certificados están listos
RUN update-ca-certificates

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
EXPOSE 5111

# Crear la carpeta de sesión dentro del contenedor
RUN mkdir -p /app/auth_info && chmod -R 775 /app

# Expone el puerto definido en .env o por defecto 5111
CMD ["node", "index.js"]