#!/bin/sh
set -e

# =============================================================
# Mosquitto MQTT Broker Entrypoint for Clever Cloud
# =============================================================

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

# --- Internal metrics user (auto-generated password, not exposed) ---
METRICS_USER="${MQTT_METRICS_USER:-metrics}"
METRICS_PASS="$(head -c 32 /dev/urandom | base64 | tr -d '=+/\n')"
mosquitto_passwd -b "$PASSWD_FILE" "$METRICS_USER" "$METRICS_PASS"
echo "Registered internal MQTT user: $METRICS_USER"

# --- Fix file permissions (Mosquitto 2.1+ warns about world-readable files) ---
chmod 0700 "$PASSWD_FILE"
chmod 0700 /mosquitto/config/acl.conf

# --- Start Node metrics sidecar (serves / health + /metrics on 8080) ---
export MQTT_HOST=127.0.0.1
export MQTT_PORT=4040
export MQTT_METRICS_USER="$METRICS_USER"
export MQTT_METRICS_PASS="$METRICS_PASS"
export METRICS_HTTP_PORT="${METRICS_HTTP_PORT:-8080}"

node /app/src/metrics_server.js &
METRICS_PID=$!
echo "Metrics sidecar started (pid=$METRICS_PID) on port $METRICS_HTTP_PORT"

# Propagate signals to metrics sidecar when mosquitto exits
trap 'kill -TERM $METRICS_PID 2>/dev/null || true' TERM INT

echo "Starting Mosquitto MQTT broker on port 4040..."
exec mosquitto -c /mosquitto/config/mosquitto.conf
