FROM node:20-alpine

WORKDIR /app

# Copy app files
COPY package.json ./
COPY server.js ./
COPY index.html ./
COPY style.css ./
COPY main.js ./
COPY controller.html ./

# Install production deps only
RUN npm ci --omit=dev || npm install --omit=dev

ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O- http://127.0.0.1:${PORT}/health >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
