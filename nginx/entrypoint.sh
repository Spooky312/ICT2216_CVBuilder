#!/bin/sh
set -e

CERT=/etc/nginx/certs/cert.pem
KEY=/etc/nginx/certs/key.pem

if [ -f "$CERT" ] && [ -f "$KEY" ]; then
    echo "[nginx] TLS certificates found — starting with HTTPS"
    cp /etc/nginx/nginx-https.conf /etc/nginx/nginx.conf
else
    echo "[nginx] No TLS certificates found — starting with HTTP only"
    cp /etc/nginx/nginx-http.conf /etc/nginx/nginx.conf
fi

# Hand off to the official nginx docker entrypoint (handles IPv6, envsubst, etc.)
exec /docker-entrypoint.sh "$@"
