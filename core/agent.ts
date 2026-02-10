import type { Planner, Step, MissionContext } from "./planner";
import type { Executor } from "./executor";
import type {
  ControlPlanePort,
  StepProposal,
  StepResult
} from "../ports/control-plane";

export interface AgentConfig {
  missionId: string;
  maxSteps?: number;
}

export interface AgentDependencies {
  planner: Planner;
  executor: Executor;
  controlPlane: ControlPlanePort;
}

export class AgentRuntime {
  private readonly planner: Planner;
  private readonly executor: Executor;
  private readonly controlPlane: ControlPlanePort;
  private readonly config: AgentConfig;
  private readonly history: Step[] = [];

  constructor(config: AgentConfig, deps: AgentDependencies) {
    this.config = config;
    this.planner = deps.planner;
    this.executor = deps.executor;
    this.controlPlane = deps.controlPlane;
  }

  async run(): Promise<void> {
    const maxSteps = this.config.maxSteps ?? 50;

    for (let i = 0; i < maxSteps; i += 1) {
      const context: MissionContext = {
        missionId: this.config.missionId,
        history: [...this.history]
      };

      const step = await this.planner.nextStep(context);
      if (!step) {
        return;
      }

      const proposal: StepProposal = {
        missionId: this.config.missionId,
        stepId: step.id,
        action: step.action,
        payload: step.payload
      };

      const decision = await this.controlPlane.proposeStep(proposal);
      if (!decision.approved) {
        step.status = "rejected";
        this.history.push(step);
        if (this.planner.onRejection) {
          await this.planner.onRejection(step, decision.reason);
        }
        continue;
      }

      step.status = "approved";
      const result = await this.executor.execute(step);

      const report: StepResult = {
        missionId: this.config.missionId,
        stepId: step.id,
        success: result.success,
        output: result.output,
        error: result.error
      };

      await this.controlPlane.reportResult(report);

      step.status = result.success ? "completed" : "failed";
      this.history.push(step);

      if (this.planner.onResult) {
        await this.planner.onResult(step);
      }
    }
  }
}
