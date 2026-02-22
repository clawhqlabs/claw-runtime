import { httpJson } from "../tools/network";
import type { RuntimeEvent } from "../ports/runtime-protocol";

export interface RuntimeTransportConfig {
  baseUrl: string;
  agentId: string;
}

export async function sendRuntimeEvent(
  config: RuntimeTransportConfig,
  event: RuntimeEvent
): Promise<void> {
  await httpJson(
    `${config.baseUrl}/agent/${config.agentId}/heartbeat`,
    "POST",
    event
  );
}
