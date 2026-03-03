# mqtt_climato

Mosquitto MQTT broker for weather station data collection, deployed as a Docker application on Clever Cloud.

## Architecture

```
[Station 01] --publish--> climato/station01/data \
[Station 02] --publish--> climato/station02/data  --> [ Mosquitto MQTT ] --> climato/# --> [Backend]
[Station N ] --publish--> climato/stationN/data  /        (Clever Cloud)
```

- **Broker**: Eclipse Mosquitto 2.x
- **Auth**: username/password per station + dedicated `backend` user
- **ACL**: stations can only publish to their own topic, backend can only subscribe
- **QoS**: 0 and 1 (at least once delivery)

## Project Structure

```
mqtt_climato/
├── Dockerfile                  # Docker image for Clever Cloud
├── mosquitto/
│   ├── mosquitto.conf          # Broker config (port 4040, auth, persistence)
│   ├── acl.conf                # Access control rules
│   └── entrypoint.sh           # Health check (port 8080) + password setup + broker start
├── CLAUDE.md
└── README.md
```

## Prerequisites

- [clever-tools](https://github.com/CleverCloud/clever-tools) CLI installed
- A Clever Cloud account with access to org `orga_3fec1295-2308-4a56-abc0-e07405b62eb6`
- Git

## Installation on Clever Cloud

### Step 1 — Install Clever Tools

```bash
npm install -g clever-tools
# or
brew install CleverCloud/tap/clever-tools
```

### Step 2 — Login

```bash
clever login
```

### Step 3 — Create the Docker Application

```bash
clever create -t docker "bd_climato::MQTT" \
  --org orga_3fec1295-2308-4a56-abc0-e07405b62eb6 \
  --region par
```

### Step 4 — Set Environment Variables

```bash
# Define MQTT users (stations + backend)
# In future we'll create a login for each station
clever env set MQTT_USERS "station:ILoveMeteor_974,backend:Meteor@974?"

# Tell Clever Cloud which port is used for MQTT TCP traffic
clever env set CC_DOCKER_EXPOSED_TCP_PORT "4040"
```

### Step 5 — Enable TCP Redirection

MQTT uses raw TCP, not HTTP. Clever Cloud needs a TCP redirection to expose the broker:

```bash
clever tcp-redirs add --namespace cleverapps
```

### Step 6 — Deploy

```bash
git add Dockerfile mosquitto/
git commit -m "Add Mosquitto MQTT broker for Clever Cloud"
clever deploy
```

### Step 7 — Get the Assigned MQTT Port

```bash
clever tcp-redirs list
```

Output example:

```
Namespace    Port
cleverapps   5220
```

The external port (e.g. `5220`) is what MQTT clients will use to connect.

### Step 8 — Verify

Check the domain assigned to your app:

```bash
clever domain
```

Check the logs to confirm the broker started:

```bash
clever logs --follow
```

You should see lines like:

```
Registered MQTT user: station01
Registered MQTT user: backend
Starting Mosquitto MQTT broker on port 4040...
```

## Connecting MQTT Clients

### Station

```
Host:      <your-app>.cleverapps.io
Port:      <port from step 7>
Protocol:  MQTT (TCP)
Username:  station01
Password:  <password from MQTT_USERS>
Pub topic: climato/station01/data
QoS:       0 or 1
```

### Backend

```
Host:      <your-app>.cleverapps.io
Port:      <port from step 7>
Protocol:  MQTT (TCP)
Username:  backend
Password:  <password from MQTT_USERS>
Subscribe: climato/#
```

## Managing Stations

To add or remove stations, update the `MQTT_USERS` environment variable and restart:

```bash
clever env set MQTT_USERS "station01:p1,station02:p2,station03:p3,backend:bp"
clever restart
```

The password file is regenerated on each startup from this variable.

## Topic Structure

| Topic | Direction | Description |
|---|---|---|
| `climato/{station_id}/data` | Station -> Broker | Station publishes sensor readings |
| `climato/#` | Broker -> Backend | Backend subscribes to all station data |

## Deploying Changes

After committing your changes locally, push to Clever Cloud:

```bash
clever deploy
```

This triggers a full rebuild of the Docker image and restarts the broker.

To monitor the deployment:

```bash
clever logs --follow
```

If deployment fails, check the logs for errors. To force a redeploy without new commits:

```bash
clever restart
```

## Notes

- **Health check**: Clever Cloud requires HTTP 200 on port 8080. A lightweight BusyBox `httpd` serves this automatically.
- **Persistence**: Works within a deployment's lifecycle but is lost on redeployment (FS Buckets are not supported for Docker apps on Clever Cloud). This is acceptable — stations reconnect and resume publishing.
- **TLS**: Not yet enabled. Planned for a future update.
