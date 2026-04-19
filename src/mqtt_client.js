const mqtt = require("mqtt");
const pino = require("pino");
require("dotenv").config();

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

const stationId = process.argv[2] || process.env.MQTT_STATION_USER;
if (!stationId) {
  logger.error("Usage: node src/mqtt_client.js [station_id] (defaults to MQTT_STATION_USER)");
  process.exit(1);
}

const host = process.env.MQTT_HOST;
const port = process.env.MQTT_PORT;
const username = process.env.MQTT_STATION_USER;
const password = process.env.MQTT_STATION_PASS;
const topic = `climato/${stationId}/data`;

logger.info({ host, port, username }, "connecting to mqtt broker");

const client = mqtt.connect(`mqtt://${host}:${port}`, {
  username,
  password,
  protocolVersion: 5,
  connectTimeout: 10000,
});

client.on("connect", (connack) => {
  logger.info({ reasonCode: connack.reasonCode }, "connected");

  const payload = JSON.stringify({
    station_id: stationId,
    timestamp: new Date().toISOString(),
    temperature: +(20 + Math.random() * 10).toFixed(1),
    humidity: +(50 + Math.random() * 40).toFixed(1),
    pressure: +(1010 + Math.random() * 20).toFixed(1),
  });

  client.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      logger.error({ err: err.message }, "publish error");
    } else {
      logger.info({ topic, payload }, "published");
    }
    client.end();
  });
});

client.on("error", (err) => {
  logger.error({ err: err.message }, "mqtt error");
  process.exit(1);
});

client.on("disconnect", (packet) => {
  logger.warn({ reasonCode: packet.reasonCode }, "disconnected by broker");
});
