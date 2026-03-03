const mqtt = require("mqtt");
require("dotenv").config();

const stationId = process.argv[2] || process.env.MQTT_STATION_USER;
if (!stationId) {
  console.error("Usage: node src/mqtt_client.js [station_id]");
  console.error("Defaults to MQTT_STATION_USER from .env if no argument given");
  process.exit(1);
}

const host = process.env.MQTT_HOST;
const port = process.env.MQTT_PORT;
const username = process.env.MQTT_STATION_USER;
const password = process.env.MQTT_STATION_PASS;
const topic = `climato/${stationId}/data`;

console.log(`Connecting to mqtt://${host}:${port} as '${username}'...`);

const client = mqtt.connect(`mqtt://${host}:${port}`, {
  username,
  password,
  protocolVersion: 5,
  connectTimeout: 10000,
});

client.on("connect", (connack) => {
  console.log(`Connected (reason: ${connack.reasonCode})`);

  const payload = JSON.stringify({
    station_id: stationId,
    timestamp: new Date().toISOString(),
    temperature: +(20 + Math.random() * 10).toFixed(1),
    humidity: +(50 + Math.random() * 40).toFixed(1),
    pressure: +(1010 + Math.random() * 20).toFixed(1),
  });

  client.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error("Publish error:", err.message);
    } else {
      console.log(`Published to ${topic}:`);
      console.log(payload);
    }
    client.end();
  });
});

client.on("error", (err) => {
  console.error("Error:", err.message);
  process.exit(1);
});

client.on("disconnect", (packet) => {
  console.error("Disconnected by broker, reason:", packet.reasonCode);
});
