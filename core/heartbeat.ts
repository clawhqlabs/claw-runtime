import { sendRuntimeEvent } from "./runtime-transport";
import { PROTOCOL_VERSION, type HeartbeatPayload } from "../ports/runtime-protocol";

export interface HeartbeatConfig {
  baseUrl: string;
  agentId: string;
  intervalMs: number;
}

export function startHeartbeat(
  config: HeartbeatConfig,
  getPayload: () => HeartbeatPayload
): () => void {
  const interval = setInterval(async () => {
    const payload = getPayload();
    await sendRuntimeEvent(
      { baseUrl: config.baseUrl, agentId: config.agentId },
      {
        protocolVersion: PROTOCOL_VERSION,
        type: "heartbeat",
        timestamp: new Date().toISOString(),
        payload
      }
    );
  }, config.intervalMs);

  return () => clearInterval(interval);
}
