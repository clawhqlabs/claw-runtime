import type {
  ControlPlaneDecision,
  ControlPlanePort,
  StepProposal,
  StepResult
} from "../../ports/control-plane";

export interface MockControlPlaneOptions {
  approveAll?: boolean;
  approvalDecider?: (proposal: StepProposal) => ControlPlaneDecision;
  recordHistory?: boolean;
}

export interface MockControlPlaneState {
  proposals: StepProposal[];
  results: StepResult[];
}

export class MockControlPlaneClient implements ControlPlanePort {
  private readonly options: MockControlPlaneOptions;
  private readonly state: MockControlPlaneState;

  constructor(options: MockControlPlaneOptions = {}) {
    this.options = options;
    this.state = {
      proposals: [],
      results: []
    };
  }

  getState(): MockControlPlaneState {
    return {
      proposals: [...this.state.proposals],
      results: [...this.state.results]
    };
  }

  async proposeStep(proposal: StepProposal): Promise<ControlPlaneDecision> {
    if (this.options.recordHistory !== false) {
      this.state.proposals.push(proposal);
    }

    if (this.options.approvalDecider) {
      return this.options.approvalDecider(proposal);
    }

    return { approved: this.options.approveAll !== false };
  }

  async reportResult(result: StepResult): Promise<void> {
    if (this.options.recordHistory !== false) {
      this.state.results.push(result);
    }
  }
}
