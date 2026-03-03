# MQTT Climato

## Project Overview

MQTT broker (Eclipse Mosquitto 2.x) for weather station data collection, deployed as a Docker application on Clever Cloud.

## Architecture

- **Broker**: Eclipse Mosquitto 2.x in Docker
- **Deployment**: Clever Cloud Docker application
- **Auth**: Username/password per station + dedicated backend user
- **ACL**: Stations publish to `climato/{station_id}/data`, backend subscribes to `climato/#`
- **Persistence**: In-container only (FS Buckets not supported for Docker on Clever Cloud)

## Key Files

- `Dockerfile` — Docker image for Clever Cloud deployment
- `mosquitto/mosquitto.conf` — Broker configuration (port 4040, auth, persistence)
- `mosquitto/acl.conf` — Access control (stations=write, backend=read)
- `mosquitto/entrypoint.sh` — Container entrypoint (health check on 8080 + password generation + Mosquitto start)

## Clever Cloud Configuration

- **App type**: Docker
- **HTTP port**: 8080 (health check only, serves "OK")
- **TCP port**: 4040 (MQTT, exposed via TCP redirection with a dynamically assigned external port)
- **Environment variable**: `MQTT_USERS` = `station01:pass1,station02:pass2,backend:backendpass`
- **Add-ons available**: PostgreSQL, FS Bucket (FS Bucket not usable with Docker apps)

## MQTT Topics

- `climato/{station_id}/data` — Station publishes sensor data (QoS 0 or 1)
- `climato/#` — Backend subscribes to all station data

## Users & ACL

- **Station users**: username = station ID, can only publish to `climato/<username>/data`
- **`backend` user**: can subscribe to all `climato/#` topics
- Users are defined via `MQTT_USERS` env var and regenerated on each deployment

## Future Plans

- TLS encryption for MQTT connections
