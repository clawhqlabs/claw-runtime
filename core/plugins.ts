import type { Step } from "./planner";

export interface ToolCallContext {
  step: Step;
}

export interface ToolResultContext {
  step: Step;
  result: unknown;
}

export interface MemoryWriteContext {
  location: string;
  content: unknown;
}

export interface RuntimePlugin {
  name?: string;
  order?: number;
  beforeToolCall?(context: ToolCallContext): Promise<void> | void;
  afterToolCall?(context: ToolResultContext): Promise<void> | void;
  onMemoryWrite?(context: MemoryWriteContext): Promise<void> | void;
  onRuntimeError?(error: Error): Promise<void> | void;
}

export class PluginHost {
  private readonly plugins: Array<{ plugin: RuntimePlugin; order: number; seq: number }> = [];
  private readonly errors: Array<{ plugin: string; error: Error }> = [];
  private sequence = 0;

  registerPlugin(plugin: RuntimePlugin): void {
    this.plugins.push({
      plugin,
      order: plugin.order ?? 0,
      seq: this.sequence++
    });
    this.plugins.sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.seq - b.seq;
    });
  }

  register(plugin: RuntimePlugin): void {
    this.registerPlugin(plugin);
  }

  getErrors(): Array<{ plugin: string; error: Error }> {
    return [...this.errors];
  }

  async emitBeforeTool(step: Step): Promise<void> {
    for (const entry of this.plugins) {
      const plugin = entry.plugin;
      if (plugin.beforeToolCall) {
        await this.safeInvoke(plugin, "beforeToolCall", () =>
          plugin.beforeToolCall?.({ step })
        );
      }
    }
  }

  async emitAfterTool(step: Step, result: unknown): Promise<void> {
    for (const entry of this.plugins) {
      const plugin = entry.plugin;
      if (plugin.afterToolCall) {
        await this.safeInvoke(plugin, "afterToolCall", () =>
          plugin.afterToolCall?.({ step, result })
        );
      }
    }
  }

  async emitMemoryWrite(location: string, content: unknown): Promise<void> {
    for (const entry of this.plugins) {
      const plugin = entry.plugin;
      if (plugin.onMemoryWrite) {
        await this.safeInvoke(plugin, "onMemoryWrite", () =>
          plugin.onMemoryWrite?.({ location, content })
        );
      }
    }
  }

  async emitRuntimeError(error: Error): Promise<void> {
    for (const entry of this.plugins) {
      const plugin = entry.plugin;
      if (plugin.onRuntimeError) {
        await this.safeInvoke(plugin, "onRuntimeError", () =>
          plugin.onRuntimeError?.(error)
        );
      }
    }
  }

  private async safeInvoke(
    plugin: RuntimePlugin,
    hook: string,
    fn: () => Promise<void> | void
  ): Promise<void> {
    try {
      await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown error");
      const name = plugin.name ?? "anonymous-plugin";
      this.errors.push({ plugin: `${name}:${hook}`, error: err });
      // Keep main loop alive; plugin errors are isolated by design.
    }
  }
}
