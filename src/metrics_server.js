const http = require("http");
const mqtt = require("mqtt");
const pino = require("pino");
const client = require("prom-client");

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

const HTTP_PORT = parseInt(process.env.METRICS_HTTP_PORT || "8080", 10);
const MQTT_HOST = process.env.MQTT_HOST || "127.0.0.1";
const MQTT_PORT = parseInt(process.env.MQTT_PORT || "4040", 10);
const MQTT_USER = process.env.MQTT_METRICS_USER || "metrics";
const MQTT_PASS = process.env.MQTT_METRICS_PASS || "";

const register = new client.Registry();
register.setDefaultLabels({ service: "mqtt_climato" });
client.collectDefaultMetrics({ register });

const sysGaugeMap = {
  "$SYS/broker/clients/connected": "mosquitto_clients_connected",
  "$SYS/broker/clients/total": "mosquitto_clients_total",
  "$SYS/broker/clients/maximum": "mosquitto_clients_maximum",
  "$SYS/broker/clients/active": "mosquitto_clients_active",
  "$SYS/broker/clients/inactive": "mosquitto_clients_inactive",
  "$SYS/broker/clients/disconnected": "mosquitto_clients_disconnected",
  "$SYS/broker/clients/expired": "mosquitto_clients_expired",
  "$SYS/broker/subscriptions/count": "mosquitto_subscriptions_count",
  "$SYS/broker/retained messages/count": "mosquitto_retained_messages_count",
  "$SYS/broker/messages/received": "mosquitto_messages_received_total",
  "$SYS/broker/messages/sent": "mosquitto_messages_sent_total",
  "$SYS/broker/messages/stored": "mosquitto_messages_stored",
  "$SYS/broker/publish/messages/received": "mosquitto_publish_messages_received_total",
  "$SYS/broker/publish/messages/sent": "mosquitto_publish_messages_sent_total",
  "$SYS/broker/publish/messages/dropped": "mosquitto_publish_messages_dropped_total",
  "$SYS/broker/publish/bytes/received": "mosquitto_publish_bytes_received_total",
  "$SYS/broker/publish/bytes/sent": "mosquitto_publish_bytes_sent_total",
  "$SYS/broker/bytes/received": "mosquitto_bytes_received_total",
  "$SYS/broker/bytes/sent": "mosquitto_bytes_sent_total",
  "$SYS/broker/uptime": "mosquitto_uptime_seconds",
  "$SYS/broker/heap/current": "mosquitto_heap_current_bytes",
  "$SYS/broker/heap/maximum": "mosquitto_heap_maximum_bytes",
};

const sysGauges = {};
for (const [topic, name] of Object.entries(sysGaugeMap)) {
  sysGauges[topic] = new client.Gauge({ name, help: `Mosquitto ${topic}`, registers: [register] });
}

const stationMessages = new client.Counter({
  name: "mqtt_station_messages_total",
  help: "Total MQTT messages received per station",
  labelNames: ["station"],
  registers: [register],
});

const stationBytes = new client.Counter({
  name: "mqtt_station_bytes_total",
  help: "Total MQTT payload bytes received per station",
  labelNames: ["station"],
  registers: [register],
});

const mqttConnected = new client.Gauge({
  name: "mqtt_metrics_client_connected",
  help: "Metrics collector MQTT client connection state (1=connected, 0=disconnected)",
  registers: [register],
});
mqttConnected.set(0);

const mqttReconnects = new client.Counter({
  name: "mqtt_metrics_client_reconnects_total",
  help: "Metrics collector reconnect attempts",
  registers: [register],
});

function parseSysNumber(buf) {
  const s = buf.toString().trim();
  const num = Number.parseFloat(s);
  if (Number.isFinite(num)) return num;
  const m = s.match(/^([0-9]+(?:\.[0-9]+)?)/);
  return m ? Number.parseFloat(m[1]) : null;
}

const mqttUrl = `mqtt://${MQTT_HOST}:${MQTT_PORT}`;
logger.info({ mqttUrl, user: MQTT_USER }, "metrics collector connecting");

const mqttClient = mqtt.connect(mqttUrl, {
  username: MQTT_USER,
  password: MQTT_PASS,
  clientId: "mqtt-climato-metrics",
  clean: true,
  reconnectPeriod: 5000,
  connectTimeout: 10000,
});

mqttClient.on("connect", () => {
  mqttConnected.set(1);
  logger.info("metrics collector connected to broker");
  mqttClient.subscribe(["$SYS/#", "climato/+/data"], { qos: 0 }, (err, granted) => {
    if (err) {
      logger.error({ err: err.message }, "subscribe error");
      return;
    }
    for (const g of granted) {
      if (g.qos === 128) {
        logger.warn({ topic: g.topic }, "subscription refused by ACL");
      } else {
        logger.info({ topic: g.topic, qos: g.qos }, "subscribed");
      }
    }
  });
});

mqttClient.on("reconnect", () => {
  mqttReconnects.inc();
  logger.warn("metrics collector reconnecting");
});

mqttClient.on("close", () => {
  mqttConnected.set(0);
});

mqttClient.on("error", (err) => {
  logger.error({ err: err.message }, "mqtt error");
});

mqttClient.on("message", (topic, message) => {
  if (topic.startsWith("$SYS/")) {
    const gauge = sysGauges[topic];
    if (!gauge) return;
    const val = parseSysNumber(message);
    if (val !== null) gauge.set(val);
    return;
  }

  const parts = topic.split("/");
  if (parts[0] === "climato" && parts[2] === "data") {
    const station = parts[1] || "unknown";
    stationMessages.inc({ station });
    stationBytes.inc({ station }, message.length);
  }
});

const server = http.createServer(async (req, res) => {
  const started = process.hrtime.bigint();
  try {
    if (req.url === "/metrics") {
      const body = await register.metrics();
      res.writeHead(200, { "Content-Type": register.contentType });
      res.end(body);
    } else if (req.url === "/" || req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("OK");
    } else if (req.url === "/refreshCache" && req.method === "POST") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("OK");
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  } catch (err) {
    logger.error({ err: err.message, url: req.url }, "http handler error");
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  } finally {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    logger.debug({ method: req.method, url: req.url, status: res.statusCode, durationMs }, "http request");
  }
});

server.listen(HTTP_PORT, "0.0.0.0", () => {
  logger.info({ port: HTTP_PORT }, "metrics HTTP server listening");
});

function shutdown(signal) {
  logger.info({ signal }, "shutting down");
  server.close();
  mqttClient.end(false, () => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
