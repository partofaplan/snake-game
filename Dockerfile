FROM nginx:1.27-alpine

# Copy a minimal nginx config (gzip + static hosting) and app assets
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY style.css /usr/share/nginx/html/style.css
COPY main.js /usr/share/nginx/html/main.js

# Run as non-root (uid 101 is the nginx user on alpine)
RUN chown -R 101:0 /var/cache/nginx /var/run /usr/share/nginx/html /etc/nginx/conf.d \
  && chmod -R g=u /var/cache/nginx /var/run /usr/share/nginx/html /etc/nginx/conf.d
USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:8080/ >/dev/null 2>&1 || exit 1
