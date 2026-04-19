const mqtt = require("mqtt");
const pino = require("pino");
require("dotenv").config();

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

const host = process.env.MQTT_HOST;
const port = process.env.MQTT_PORT;
const username = process.env.MQTT_BACKEND_USER;
const password = process.env.MQTT_BACKEND_PASS;
const topic = "climato/#";

logger.info({ host, port, username }, "connecting to mqtt broker");

const client = mqtt.connect(`mqtt://${host}:${port}`, {
  username,
  password,
  protocolVersion: 5,
  connectTimeout: 10000,
  clientId: "climato-backend",
  clean: false,
  properties: {
    sessionExpiryInterval: 86400,
  },
});

client.on("connect", (connack) => {
  logger.info({ reasonCode: connack.reasonCode }, "connected");

  client.subscribe(topic, { qos: 1 }, (err, granted) => {
    if (err) {
      logger.error({ err: err.message }, "subscribe error");
      process.exit(1);
    }
    const result = granted[0];
    if (result.qos === 128) {
      logger.error({ topic }, "subscription refused by broker (ACL denied or topic invalid)");
      process.exit(1);
    }
    logger.info({ topic, qos: result.qos }, "subscribed");
  });
});

client.on("message", (topic, message) => {
  const poste = topic.split("/")[1];
  try {
    const data = JSON.parse(message.toString());
    logger.info({ topic, station: poste, data }, "message received");
  } catch {
    logger.info({ topic, station: poste, raw: message.toString() }, "message received (non-json)");
  }
});

client.on("error", (err) => {
  logger.error({ err: err.message }, "mqtt error");
  process.exit(1);
});

client.on("disconnect", (packet) => {
  logger.warn({ reasonCode: packet.reasonCode }, "disconnected by broker");
});

client.on("offline", () => {
  logger.warn("client went offline");
});

client.on("reconnect", () => {
  logger.info("reconnecting");
});

process.on("SIGINT", () => {
  logger.info("disconnecting");
  client.end(false, () => process.exit(0));
});
