# TODO

- [ ] Create a dedicated MQTT user per station (e.g., `MTG280:password`) and switch ACL from `topic write climato/+/data` back to `pattern write climato/%u/data` so each station can only publish to its own topic
- [ ] Enable TLS encryption for MQTT connections
