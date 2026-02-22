import { sendRuntimeEvent } from "./runtime-transport";
import { PROTOCOL_VERSION } from "../ports/runtime-protocol";
import type { WatchdogPayload } from "../ports/runtime-protocol";

export interface WatchdogConfig {
  baseUrl: string;
  agentId: string;
  autoExit?: boolean;
}

export function startWatchdog(config: WatchdogConfig): () => void {
  const handler = async (error: unknown) => {
    const err = error instanceof Error ? error : new Error(String(error));
    const payload: WatchdogPayload = {
      status: "crashed",
      error: {
        message: err.message,
        stack: err.stack,
        name: err.name
      }
    };

    try {
      await sendRuntimeEvent(
        { baseUrl: config.baseUrl, agentId: config.agentId },
        {
          protocolVersion: PROTOCOL_VERSION,
          type: "watchdog",
          timestamp: new Date().toISOString(),
          payload
        }
      );
    } finally {
      if (config.autoExit) {
        process.exit(1);
      }
    }
  };

  const onUncaught = (err: Error) => {
    void handler(err);
  };

  const onUnhandled = (reason: unknown) => {
    void handler(reason);
  };

  process.on("uncaughtException", onUncaught);
  process.on("unhandledRejection", onUnhandled);

  return () => {
    process.off("uncaughtException", onUncaught);
    process.off("unhandledRejection", onUnhandled);
  };
}
