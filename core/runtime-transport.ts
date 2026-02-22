import type {
  RegisterPayload,
  RuntimeEvent,
  RuntimeEventType
} from "../ports/runtime-protocol";
import { PROTOCOL_VERSION } from "../ports/runtime-protocol";

export interface RuntimeTransportConfig {
  baseUrl: string;
  agentId: string;
}

export interface RuntimeEventInput<TType extends RuntimeEventType, TPayload> {
  type: TType;
  payload: TPayload;
}

interface TransportResponse {
  error?: string;
}

async function postEvent(
  config: RuntimeTransportConfig,
  event: RuntimeEvent
): Promise<TransportResponse | null> {
  const token = process.env.RUNTIME_TOKEN;
  if (!token) {
    throw new Error("Missing runtime token");
  }

  const response = await fetch(
    `${config.baseUrl}/agent/${config.agentId}/heartbeat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(event)
    }
  );

  if (response.status === 401) {
    console.error("Unauthorized runtime token");
    process.exit(1);
  }

  let body: TransportResponse | null = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text) as TransportResponse;
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return body;
}

export async function sendRuntimeEvent(
  config: RuntimeTransportConfig,
  event: RuntimeEvent
): Promise<void> {
  await postEvent(config, event);
}

export async function registerRuntime(
  config: RuntimeTransportConfig,
  payload: RegisterPayload
): Promise<void> {
  const event: RuntimeEvent = {
    protocolVersion: PROTOCOL_VERSION,
    type: "register",
    timestamp: new Date().toISOString(),
    payload
  };
  const response = await postEvent(config, event);
  if (response?.error === "unsupported_protocol") {
    console.error("Unsupported protocol");
    process.exit(1);
  }
}
