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
  let failureCount = 0;
  const interval = setInterval(async () => {
    const payload = getPayload();
    try {
      await sendRuntimeEvent(
        { baseUrl: config.baseUrl, agentId: config.agentId },
        {
          protocolVersion: PROTOCOL_VERSION,
          type: "heartbeat",
          timestamp: new Date().toISOString(),
          payload
        }
      );
      failureCount = 0;
    } catch (error) {
      failureCount += 1;
      if (failureCount >= 10) {
        console.error("Heartbeat lost, exiting");
        process.exit(1);
      }
    }
  }, config.intervalMs);

  return () => clearInterval(interval);
}
