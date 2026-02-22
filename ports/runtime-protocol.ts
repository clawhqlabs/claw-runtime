export const PROTOCOL_VERSION = "1.0" as const;

export type ProtocolVersion = typeof PROTOCOL_VERSION;

export type RuntimeEventType = "heartbeat" | "watchdog";

export interface RuntimeEventBase {
  protocolVersion: ProtocolVersion;
  type: RuntimeEventType;
  timestamp: string;
}

export interface HeartbeatPayload {
  status: "running" | "idle" | "stopped";
  memorySize?: number;
  tokenUsage?: number;
}

export interface WatchdogPayload {
  status: "crashed" | "error";
  error: {
    message: string;
    stack?: string;
    name?: string;
  };
}

export interface HeartbeatEvent extends RuntimeEventBase {
  type: "heartbeat";
  payload: HeartbeatPayload;
}

export interface WatchdogEvent extends RuntimeEventBase {
  type: "watchdog";
  payload: WatchdogPayload;
}

export type RuntimeEvent = HeartbeatEvent | WatchdogEvent;
