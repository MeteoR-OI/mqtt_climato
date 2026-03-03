const mqtt = require("mqtt");
require("dotenv").config();

const host = process.env.MQTT_HOST;
const port = process.env.MQTT_PORT;
const username = process.env.MQTT_BACKEND_USER;
const password = process.env.MQTT_BACKEND_PASS;
const topic = "climato/#";

console.log(`Connecting to mqtt://${host}:${port} as '${username}'...`);

const client = mqtt.connect(`mqtt://${host}:${port}`, {
  username,
  password,
  protocolVersion: 5,
  connectTimeout: 10000,
});

client.on("connect", (connack) => {
  console.log(`Connected (reason: ${connack.reasonCode})`);

  client.subscribe(topic, { qos: 1 }, (err, granted) => {
    if (err) {
      console.error("Subscribe error:", err.message);
      process.exit(1);
    }
    const result = granted[0];
    if (result.qos === 128) {
      console.error("Subscription refused by broker (ACL denied or topic invalid)");
      process.exit(1);
    }
    console.log(`Subscribed to ${topic} (granted QoS ${result.qos})`);
    console.log("Waiting for messages... (Ctrl+C to stop)\n");
  });
});

client.on("message", (topic, message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${topic}`);
  try {
    const data = JSON.parse(message.toString());
    console.log(JSON.stringify(data, null, 2));
  } catch {
    console.log(message.toString());
  }
  console.log("---");
});

client.on("error", (err) => {
  console.error("Error:", err.message);
  process.exit(1);
});

client.on("disconnect", (packet) => {
  console.error("Disconnected by broker, reason:", packet.reasonCode);
});

client.on("offline", () => {
  console.error("Client went offline");
});

client.on("reconnect", () => {
  console.log("Reconnecting...");
});

process.on("SIGINT", () => {
  console.log("\nDisconnecting...");
  client.end(false, () => process.exit(0));
});
