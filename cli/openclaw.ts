#!/usr/bin/env node
import { AgentRuntime } from "../core/agent";
import { SimplePlanner } from "../core/planner";
import { SimpleExecutor } from "../core/executor";
import { HttpControlPlaneClient } from "../adapters/http-control-plane/client";
import { loadJsonConfig } from "../tools/fs";
import type { HttpControlPlaneConfig } from "../adapters/http-control-plane/types";
import type { ControlPlanePort } from "../ports/control-plane";

interface RuntimeConfig {
  missionId: string;
  maxSteps?: number;
  controlPlane: HttpControlPlaneConfig;
}

async function main(): Promise<void> {
  const configPath = process.argv[2] ?? "./openclaw.config.json";
  const config = await loadJsonConfig<RuntimeConfig>(configPath);

  const controlPlane: ControlPlanePort = new HttpControlPlaneClient(
    config.controlPlane
  );

  const planner = new SimplePlanner([
    {
      action: "log",
      payload: { message: "Hello from OpenClaw Runtime" }
    }
  ]);

  const executor = new SimpleExecutor();
  executor.register("log", async (payload) => {
    const message = String(payload.message ?? "");
    // Sample handler. Real handlers should be registered by the embedding system.
    console.log(message);
    return { echoed: message };
  });

  const agent = new AgentRuntime(
    { missionId: config.missionId, maxSteps: config.maxSteps },
    { planner, executor, controlPlane }
  );

  await agent.run();
}

main().catch((error) => {
  console.error("OpenClaw Runtime error:", error);
  process.exit(1);
});
