#!/bin/sh
set -e

# =============================================================
# Mosquitto MQTT Broker Entrypoint for Clever Cloud
# =============================================================

# --- HTTP health check server on port 8080 ---
# Clever Cloud requires an HTTP 200 response for deployment validation
mkdir -p /tmp/health
echo "OK" > /tmp/health/index.html
httpd -p 8080 -h /tmp/health
echo "Health check server started on port 8080"

# --- Generate MQTT password file from environment ---
# Format: MQTT_USERS="user1:pass1,user2:pass2,backend:backendpass"
PASSWD_FILE="/mosquitto/config/passwd"
: > "$PASSWD_FILE"

if [ -n "$MQTT_USERS" ]; then
    echo "$MQTT_USERS" | tr ',' '\n' | while IFS=':' read -r user pass; do
        if [ -n "$user" ] && [ -n "$pass" ]; then
            mosquitto_passwd -b "$PASSWD_FILE" "$user" "$pass"
            echo "Registered MQTT user: $user"
        fi
    done
    echo "Password file generated successfully"
else
    echo "WARNING: MQTT_USERS not set. No clients will be able to authenticate."
fi

# --- Fix file permissions (Mosquitto 2.1+ warns about world-readable files) ---
chmod 0700 "$PASSWD_FILE"
chmod 0700 /mosquitto/config/acl.conf

echo "Starting Mosquitto MQTT broker on port 4040..."
exec mosquitto -c /mosquitto/config/mosquitto.conf
