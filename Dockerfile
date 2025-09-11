FROM nginx:1.27-alpine

# Copy a minimal nginx config (gzip + static hosting)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static assets into nginx's html root
COPY index.html /usr/share/nginx/html/index.html
COPY style.css /usr/share/nginx/html/style.css
COPY main.js /usr/share/nginx/html/main.js

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1

