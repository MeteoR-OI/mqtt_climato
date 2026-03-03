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

- **Organization**: `orga_3fec1295-2308-4a56-abc0-e07405b62eb6`
- **Service name**: `bd_climato::MQTT`
- **App type**: Docker
- **Region**: Paris (`par`)
- **HTTP port**: 8080 (health check only, serves "OK")
- **TCP port**: 4040 (MQTT, exposed via TCP redirection with a dynamically assigned external port)
- **Environment variable**: `MQTT_USERS` = `station01:pass1,station02:pass2,backend:backendpass`
- **Add-ons available**: PostgreSQL, FS Bucket (FS Bucket not usable with Docker apps)

## Deployment Procedure

### 1. Install Clever Tools CLI

```bash
npm install -g clever-tools
# or
brew install CleverCloud/tap/clever-tools
```

### 2. Login

```bash
clever login
```

### 3. Create the Docker Application

```bash
clever create -t docker "bd_climato::MQTT" \
  --org orga_3fec1295-2308-4a56-abc0-e07405b62eb6 \
  --region par
```

> If colons are rejected in the name, use `bd_climato--MQTT` instead and rename
> it in the Clever Cloud console afterwards.

### 4. Set Environment Variables

```bash
clever env set MQTT_USERS "station01:CHANGE_ME_1,station02:CHANGE_ME_2,backend:CHANGE_ME_BACKEND"
clever env set CC_DOCKER_EXPOSED_TCP_PORT "4040"
```

### 5. Enable TCP Redirection (required for MQTT)

```bash
clever tcp-redirs add --namespace cleverapps
```

### 6. Deploy

```bash
git add Dockerfile mosquitto/
git commit -m "Add Mosquitto MQTT broker for Clever Cloud"
clever deploy
```

### 7. Get the Assigned MQTT Port

```bash
clever tcp-redirs list
```

Returns something like:

```
Namespace    Port
cleverapps   5220
```

### 8. Connect MQTT Clients

**Stations:**

```
Host:     bd-climato-mqtt.cleverapps.io  (check `clever domain` for exact value)
Port:     <port from step 7>
Username: station01
Password: <password set in MQTT_USERS>
Topic:    climato/station01/data
```

**Backend:**

```
Host:     bd-climato-mqtt.cleverapps.io
Port:     <port from step 7>
Username: backend
Password: <password set in MQTT_USERS>
Subscribe: climato/#
```

### 9. Monitor

```bash
clever logs --follow
```

### Adding/Removing Stations

```bash
clever env set MQTT_USERS "station01:p1,station02:p2,station03:p3,backend:bp"
clever restart
```

## MQTT Topics

- `climato/{station_id}/data` — Station publishes sensor data (QoS 0 or 1)
- `climato/#` — Backend subscribes to all station data

## Users & ACL

- **Station users**: username = station ID, can only publish to `climato/<username>/data`
- **`backend` user**: can subscribe to all `climato/#` topics
- Users are defined via `MQTT_USERS` env var and regenerated on each deployment

## Future Plans

- TLS encryption for MQTT connections
