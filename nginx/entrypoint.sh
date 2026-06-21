#!/bin/sh
set -e

CERT=/etc/nginx/certs/CVBuildApp.crt
KEY=/etc/nginx/certs/CVBuildApp.key

if [ -f "$CERT" ] && [ -f "$KEY" ]; then
    echo "[nginx] TLS certificates found — starting with HTTPS"
    sudo chmod 644 /etc/nginx/certs/CVBuildApp.crt
    sudo chmod 600 /etc/nginx/certs/CVBuildApp.key
    cp /etc/nginx/nginx-https.conf /etc/nginx/nginx.conf
else
    echo "[nginx] No TLS certificates found — starting with HTTP only"
    cp /etc/nginx/nginx-http.conf /etc/nginx/nginx.conf
fi

# Hand off to the official nginx docker entrypoint (handles IPv6, envsubst, etc.)
exec /docker-entrypoint.sh "$@"
