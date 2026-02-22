# Runtime → Control Plane Contract

This document defines the versioned protocol for runtime-originated payloads.
All outbound events include a `protocolVersion` field to ensure backward
compatibility as the contract evolves.

## Protocol Version

`protocolVersion`: string

Current version: `1.0`

## Transport

The runtime sends all events to:

`POST /agent/:id/heartbeat`

The payload is a discriminated union keyed by `type`.

## Schema

```
RuntimeEvent {
  protocolVersion: "1.0"
  type: "heartbeat" | "watchdog" | "register"
  timestamp: string (ISO-8601)
  payload: HeartbeatPayload | WatchdogPayload | RegisterPayload
}

HeartbeatPayload {
  status: "running" | "idle" | "stopped"
  memorySize?: number
  tokenUsage?: number
}

WatchdogPayload {
  status: "crashed" | "error"
  error: {
    message: string
    stack?: string
    name?: string
  }
}

RegisterPayload {
  runtimeId: string
  nodeEnv?: string
  runtimeVersion: string
}
```

## Backward Compatibility

- New optional fields can be added without breaking existing control planes.
- Existing fields should not change meaning or type.
- New `type` variants must be ignored safely by older control planes.
