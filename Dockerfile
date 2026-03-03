FROM eclipse-mosquitto:2

USER root

# Copy configuration files
COPY mosquitto/mosquitto.conf /mosquitto/config/mosquitto.conf
COPY mosquitto/acl.conf /mosquitto/config/acl.conf
COPY mosquitto/entrypoint.sh /entrypoint.sh

# Install busybox-extras for httpd (health check server)
RUN apk add --no-cache busybox-extras

# Set up permissions and directories
RUN chmod +x /entrypoint.sh \
    && mkdir -p /mosquitto/data /mosquitto/log \
    && chown -R mosquitto:mosquitto /mosquitto

USER mosquitto

# 4040 = MQTT (Clever Cloud TCP redirection)
# 8080 = HTTP health check (Clever Cloud requirement)
EXPOSE 4040 8080

ENTRYPOINT ["/entrypoint.sh"]
