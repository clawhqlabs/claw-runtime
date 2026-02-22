#!/usr/bin/env node
import path from "node:path";
import { AgentRuntime } from "../core/agent";
import { SimplePlanner } from "../core/planner";
import { SimpleExecutor } from "../core/executor";
import { HttpControlPlaneClient } from "../adapters/http-control-plane/client";
import { loadJsonConfig } from "../tools/fs";
import type { HttpControlPlaneConfig } from "../adapters/http-control-plane/types";
import type { ControlPlanePort } from "../ports/control-plane";
import { InMemoryProposalStore } from "../core/proposals";
import { PluginHost } from "../core/plugins";
import { RuntimeService } from "../core/runtime-service";
import { startRuntimeApiServer } from "../api/server";
import { startHeartbeat } from "../core/heartbeat";
import { startWatchdog } from "../core/watchdog";

interface RuntimeConfig {
  missionId: string;
  maxSteps?: number;
  controlPlane: HttpControlPlaneConfig;
  runtimeApi?: {
    port: number;
    authToken?: string;
  };
  heartbeat?: {
    baseUrl: string;
    agentId: string;
    intervalMs: number;
  };
  watchdog?: {
    baseUrl: string;
    agentId: string;
    autoExit?: boolean;
  };
  plugins?: {
    paths: string[];
  };
  proposalTimeoutMs?: number;
  proposalAutoDecision?: "approve" | "reject";
}

function loadPlugins(host: PluginHost, paths: string[]): void {
  for (const pluginPath of paths) {
    const resolvedPath = path.isAbsolute(pluginPath)
      ? pluginPath
      : path.resolve(process.cwd(), pluginPath);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(resolvedPath);
    const factory = mod.default ?? mod;
    if (typeof factory === "function") {
      host.registerPlugin(factory());
    }
  }
}

async function main(): Promise<void> {
  const configPath = process.argv[2] ?? "./openclaw.config.json";
  const config = await loadJsonConfig<RuntimeConfig>(configPath);

  const controlPlane: ControlPlanePort = new HttpControlPlaneClient(
    config.controlPlane
  );

  const proposals = new InMemoryProposalStore({
    timeoutMs: config.proposalTimeoutMs,
    autoDecision: config.proposalAutoDecision
  });
  const plugins = new PluginHost();
  if (config.plugins?.paths?.length) {
    loadPlugins(plugins, config.plugins.paths);
  }

  const planner = new SimplePlanner([
    {
      action: "log",
      payload: { message: "Hello from Claw Runtime" }
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
    { planner, executor, controlPlane, plugins, proposals }
  );

  const runtimeService = new RuntimeService(agent, proposals);

  const runtimeApiPort =
    config.runtimeApi?.port ?? Number(process.env.RUNTIME_API_PORT);
  const runtimeApiToken =
    config.runtimeApi?.authToken ?? process.env.RUNTIME_API_TOKEN;

  if (runtimeApiPort) {
    startRuntimeApiServer(
      { port: runtimeApiPort, authToken: runtimeApiToken },
      runtimeService,
      () => process.exit(0)
    );
  }

  if (config.heartbeat) {
    startHeartbeat(config.heartbeat, () => ({
      status: runtimeService.getStatus().running ? "running" : "idle"
    }));
  }

  if (config.watchdog) {
    startWatchdog(config.watchdog);
  }

  await runtimeService.run();
}

main().catch((error) => {
  console.error("Claw Runtime error:", error);
  process.exit(1);
});
