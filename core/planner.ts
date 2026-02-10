export type StepStatus = "pending" | "approved" | "rejected" | "completed" | "failed";

export interface Step {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  status: StepStatus;
}

export interface MissionContext {
  missionId: string;
  history: Step[];
}

export interface Planner {
  nextStep(context: MissionContext): Promise<Step | null>;
  onRejection?(step: Step, reason?: string): Promise<void>;
  onResult?(step: Step): Promise<void>;
}

export class SimplePlanner implements Planner {
  private counter = 0;
  private readonly queue: Array<Omit<Step, "id" | "status">>;

  constructor(queue: Array<Omit<Step, "id" | "status">>) {
    this.queue = [...queue];
  }

  async nextStep(context: MissionContext): Promise<Step | null> {
    if (this.queue.length === 0) {
      return null;
    }

    const next = this.queue.shift();
    if (!next) {
      return null;
    }

    this.counter += 1;
    return {
      id: `step-${context.missionId}-${this.counter}`,
      action: next.action,
      payload: next.payload,
      status: "pending"
    };
  }

  async onRejection(step: Step, reason?: string): Promise<void> {
    // Minimal fallback: drop the rejected step and move on.
    // A real planner could re-plan here based on reason and history.
    void step;
    void reason;
  }

  async onResult(step: Step): Promise<void> {
    // Hook for updating internal state based on results.
    void step;
  }
}
