import type { Planner, Step, MissionContext } from "./planner";
import type { Executor } from "./executor";
import type {
  ControlPlanePort,
  StepProposal,
  StepResult
} from "../ports/control-plane";
import type { PluginHost } from "./plugins";
import type { ProposalStore } from "./proposals";

export interface AgentConfig {
  missionId: string;
  maxSteps?: number;
}

export interface AgentDependencies {
  planner: Planner;
  executor: Executor;
  controlPlane: ControlPlanePort;
  plugins?: PluginHost;
  proposals?: ProposalStore;
}

export class AgentRuntime {
  private readonly planner: Planner;
  private readonly executor: Executor;
  private readonly controlPlane: ControlPlanePort;
  private readonly plugins?: PluginHost;
  private readonly proposals?: ProposalStore;
  private readonly config: AgentConfig;
  private readonly history: Step[] = [];

  constructor(config: AgentConfig, deps: AgentDependencies) {
    this.config = config;
    this.planner = deps.planner;
    this.executor = deps.executor;
    this.controlPlane = deps.controlPlane;
    this.plugins = deps.plugins;
    this.proposals = deps.proposals;
  }

  getMissionId(): string {
    return this.config.missionId;
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

      let decision = await this.controlPlane.proposeStep(proposal);
      if (this.proposals) {
        this.proposals.create({
          id: step.id,
          missionId: this.config.missionId,
          action: step.action,
          payload: step.payload
        });
        decision = await this.proposals.awaitDecision(step.id);
      }
      if (!decision.approved) {
        step.status = "rejected";
        this.history.push(step);
        if (this.planner.onRejection) {
          await this.planner.onRejection(step, decision.reason);
        }
        continue;
      }

      step.status = "approved";
      if (this.plugins) {
        await this.plugins.emitBeforeTool(step);
      }

      let result;
      try {
        result = await this.executor.execute(step);
        if (this.plugins) {
          await this.plugins.emitAfterTool(step, result);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        if (this.plugins) {
          await this.plugins.emitRuntimeError(err);
        }
        throw err;
      }

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
