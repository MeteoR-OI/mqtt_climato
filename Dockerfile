FROM eclipse-mosquitto:2

USER root

# Install Node.js runtime for metrics sidecar
RUN apk add --no-cache nodejs npm

# Copy configuration files
COPY mosquitto/mosquitto.conf /mosquitto/config/mosquitto.conf
COPY mosquitto/acl.conf /mosquitto/config/acl.conf
COPY mosquitto/entrypoint.sh /entrypoint.sh

# Install Node dependencies and copy metrics sidecar source
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src/ ./src/

# Set up permissions and directories
RUN chmod +x /entrypoint.sh \
    && mkdir -p /mosquitto/data /mosquitto/log \
    && chown -R mosquitto:mosquitto /mosquitto /app

USER mosquitto

# 4040 = MQTT (Clever Cloud TCP redirection)
# 8080 = HTTP (health check + /metrics via Node sidecar)
EXPOSE 4040 8080

ENTRYPOINT ["/entrypoint.sh"]
