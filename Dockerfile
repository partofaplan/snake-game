FROM node:18-alpine AS base

WORKDIR /app

# Install only production deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm ci --only=production

# App assets
COPY index.html ./
COPY style.css ./
COPY main.js ./
COPY server.js ./
COPY manifest.webmanifest ./
COPY service-worker.js ./

# Default port for Cloud Run
ENV PORT=8080
EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O- http://127.0.0.1:${PORT}/ >/dev/null 2>&1 || exit 1

# Run as non-root (node user in official image)
USER node

CMD ["node", "server.js"]
