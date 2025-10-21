# syntax=docker/dockerfile:1.7

# Etapa base con Node
FROM node:20-alpine AS base
WORKDIR /app

# Etapa de dependencias
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Etapa de build
FROM deps AS build
# Recibir variables de entorno como build args
ARG VITE_API_BASE_URL
# Hacer disponible como variable de entorno durante el build
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY . .
# Verificar que la variable está disponible
RUN echo "Building with VITE_API_BASE_URL: $VITE_API_BASE_URL"
RUN npm run build

# Etapa de runtime: servidor estático con "serve" (SPA-friendly)
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Instalar servidor estático
RUN npm i -g serve@14

# Copiar artefactos de build
COPY --from=build /app/dist ./dist

# Asegurar permisos para usuario no-root
RUN addgroup -g 1001 -S nodegrp \
    && adduser -S -D -H -u 1001 nodeuser -G nodegrp \
    && chown -R nodeuser:nodegrp /app
USER nodeuser

# Exponer puerto por defecto y permitir override con $PORT
ENV PORT=3000
EXPOSE 3000

# Lanzar servidor (escucha en 0.0.0.0 y respeta $PORT)
CMD ["sh", "-c", "serve -s dist -l tcp://0.0.0.0:${PORT:-3000}"]
