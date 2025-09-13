FROM busybox:1.36

# App assets
COPY index.html /usr/share/www/index.html
COPY style.css /usr/share/www/style.css
COPY main.js /usr/share/www/main.js

# Default port for Cloud Run
ENV PORT=8080
EXPOSE 8080

# Run as non-root
USER 65532:65532

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O- http://127.0.0.1:${PORT}/ >/dev/null 2>&1 || exit 1

# Start a minimal static file server
CMD ["sh", "-c", "busybox httpd -f -v -p ${PORT:-8080} -h /usr/share/www"]
