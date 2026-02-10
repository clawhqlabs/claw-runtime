import type { HttpControlPlaneConfig } from "./types";
import type {
  ControlPlaneDecision,
  ControlPlanePort,
  StepProposal,
  StepResult
} from "../../ports/control-plane";
import { httpJson } from "../../tools/network";

export class HttpControlPlaneClient implements ControlPlanePort {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(config: HttpControlPlaneConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }

  async proposeStep(proposal: StepProposal): Promise<ControlPlaneDecision> {
    return httpJson<ControlPlaneDecision>(
      `${this.baseUrl}/steps/propose`,
      "POST",
      proposal,
      this.apiKey
    );
  }

  async reportResult(result: StepResult): Promise<void> {
    await httpJson<unknown>(
      `${this.baseUrl}/steps/report`,
      "POST",
      result,
      this.apiKey
    );
  }
}
