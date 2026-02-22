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
import { registerRuntime } from "../core/runtime-transport";

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

async function retryWithBackoff(
  fn: () => Promise<unknown>,
  options: {
    maxDurationMs: number;
    initialDelayMs: number;
    maxDelayMs: number;
  }
): Promise<void> {
  const start = Date.now();
  let delay = options.initialDelayMs;
  while (true) {
    try {
      await fn();
      return;
    } catch (error) {
      const elapsed = Date.now() - start;
      if (elapsed >= options.maxDurationMs) {
        throw error;
      }
      const jitter = Math.random() * delay * 0.5;
      const wait = Math.min(options.maxDelayMs, delay + jitter);
      await new Promise((resolve) => setTimeout(resolve, wait));
      delay = Math.min(options.maxDelayMs, delay * 2);
    }
  }
}

async function main(): Promise<void> {
  const configPath = process.argv[2] ?? "./openclaw.config.json";
  let config: RuntimeConfig | undefined;
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const controlPlaneUrl = process.env.CONTROL_PLANE_URL;
  const runtimeToken = process.env.RUNTIME_TOKEN;

  if (!controlPlaneUrl || !runtimeToken) {
    console.error("Missing required ENV");
    process.exit(1);
  }

  if (nodeEnv !== "production") {
    try {
      config = await loadJsonConfig<RuntimeConfig>(configPath);
    } catch {
      config = undefined;
    }
  }

  const mergedConfig: RuntimeConfig = {
    missionId: config?.missionId ?? "default-mission",
    maxSteps: config?.maxSteps,
    controlPlane: {
      baseUrl: controlPlaneUrl,
      apiKey: runtimeToken
    },
    runtimeApi: config?.runtimeApi,
    heartbeat: config?.heartbeat,
    watchdog: config?.watchdog,
    plugins: config?.plugins,
    proposalTimeoutMs: config?.proposalTimeoutMs,
    proposalAutoDecision: config?.proposalAutoDecision
  };

  const controlPlane: ControlPlanePort = new HttpControlPlaneClient(
    mergedConfig.controlPlane
  );

  const proposals = new InMemoryProposalStore({
    timeoutMs: mergedConfig.proposalTimeoutMs,
    autoDecision: mergedConfig.proposalAutoDecision
  });
  const plugins = new PluginHost();
  if (mergedConfig.plugins?.paths?.length) {
    loadPlugins(plugins, mergedConfig.plugins.paths);
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
    { missionId: mergedConfig.missionId, maxSteps: mergedConfig.maxSteps },
    { planner, executor, controlPlane, plugins, proposals }
  );

  const runtimeService = new RuntimeService(agent, proposals);

  const runtimeApiPort =
    mergedConfig.runtimeApi?.port ?? Number(process.env.RUNTIME_API_PORT);
  const runtimeApiToken =
    mergedConfig.runtimeApi?.authToken ?? process.env.RUNTIME_API_TOKEN;

  if (runtimeApiPort) {
    startRuntimeApiServer(
      { port: runtimeApiPort, authToken: runtimeApiToken },
      runtimeService,
      () => process.exit(0)
    );
  }

  const heartbeatConfig = mergedConfig.heartbeat ?? (controlPlaneUrl
    ? {
        baseUrl: controlPlaneUrl,
        agentId: mergedConfig.missionId,
        intervalMs: 10000
      }
    : undefined);

  let crashHandlerInstalled = false;

  if (mergedConfig.watchdog ?? controlPlaneUrl) {
    const watchdogConfig = mergedConfig.watchdog ?? {
      baseUrl: controlPlaneUrl as string,
      agentId: mergedConfig.missionId,
      autoExit: true
    };
    if (watchdogConfig.autoExit === undefined) {
      watchdogConfig.autoExit = true;
    }
    startWatchdog(watchdogConfig);
    crashHandlerInstalled = true;
  }

  const runtimeVersion = (() => {
    try {
      const pkgPath = path.resolve(process.cwd(), "package.json");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require(pkgPath).version as string;
    } catch {
      return "unknown";
    }
  })();

  try {
    await retryWithBackoff(
      () =>
        registerRuntime(
          { baseUrl: controlPlaneUrl, agentId: mergedConfig.missionId },
          {
            runtimeId: mergedConfig.missionId,
            nodeEnv,
            runtimeVersion
          }
        ),
      {
        maxDurationMs: 5 * 60 * 1000,
        initialDelayMs: 1000,
        maxDelayMs: 30000
      }
    );
  } catch (error) {
    console.error("Register failed permanently");
    process.exit(1);
  }

  const stopHeartbeat = heartbeatConfig
    ? startHeartbeat(heartbeatConfig, () => ({
        status: runtimeService.getStatus().running ? "running" : "idle"
      }))
    : undefined;

  const gracefulShutdown = () => {
    if (stopHeartbeat) {
      stopHeartbeat();
    }
    agent.stop();
    process.exit(0);
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);

  if (!crashHandlerInstalled) {
    process.on("uncaughtException", (error) => {
      console.error("Claw Runtime uncaught exception:", error);
      process.exit(1);
    });

    process.on("unhandledRejection", (reason) => {
      console.error("Claw Runtime unhandled rejection:", reason);
      process.exit(1);
    });
  }

  await runtimeService.run();
}

main().catch((error) => {
  console.error("Claw Runtime error:", error);
  process.exit(1);
});
