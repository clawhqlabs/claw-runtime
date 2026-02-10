import type { Step } from "./planner";

export type StepHandler = (payload: Record<string, unknown>) => Promise<unknown>;

export interface Executor {
  register(action: string, handler: StepHandler): void;
  execute(step: Step): Promise<StepExecutionResult>;
}

export interface StepExecutionResult {
  stepId: string;
  success: boolean;
  output?: unknown;
  error?: string;
}

export class SimpleExecutor implements Executor {
  private readonly handlers = new Map<string, StepHandler>();

  register(action: string, handler: StepHandler): void {
    this.handlers.set(action, handler);
  }

  async execute(step: Step): Promise<StepExecutionResult> {
    const handler = this.handlers.get(step.action);
    if (!handler) {
      return {
        stepId: step.id,
        success: false,
        error: `No handler registered for action: ${step.action}`
      };
    }

    try {
      const output = await handler(step.payload);
      return { stepId: step.id, success: true, output };
    } catch (error) {
      return {
        stepId: step.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
}
