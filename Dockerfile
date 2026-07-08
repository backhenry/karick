# Imagem única que compila os front-ends e roda o servidor (que os serve + WebSocket).
FROM node:20-slim

WORKDIR /app

# Copia manifests primeiro para aproveitar cache de camadas no npm install.
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/host/package.json apps/host/
COPY apps/player/package.json apps/player/
RUN npm install

# Copia o código e compila os front-ends (Player + Host).
COPY . .
RUN npm run build

# A plataforma injeta PORT; o servidor lê process.env.PORT.
ENV NODE_ENV=production
EXPOSE 3001
CMD ["npm", "start"]
