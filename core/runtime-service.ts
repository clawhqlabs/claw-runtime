import type { AgentRuntime } from "./agent";
import type { ProposalStore } from "./proposals";

export interface RuntimeStatus {
  running: boolean;
  missionId?: string;
  startedAt?: string;
  stoppedAt?: string;
}

export class RuntimeService {
  private readonly agent: AgentRuntime;
  private readonly proposals: ProposalStore;
  private status: RuntimeStatus = { running: false };

  constructor(agent: AgentRuntime, proposals: ProposalStore) {
    this.agent = agent;
    this.proposals = proposals;
  }

  async run(): Promise<void> {
    if (this.status.running) {
      return;
    }
    this.status = {
      running: true,
      missionId: this.agent.getMissionId(),
      startedAt: new Date().toISOString()
    };
    try {
      await this.agent.run();
    } finally {
      this.status = {
        ...this.status,
        running: false,
        stoppedAt: new Date().toISOString()
      };
    }
  }

  getStatus(): RuntimeStatus {
    return { ...this.status };
  }

  listProposals() {
    return this.proposals.list();
  }

  approveProposal(id: string) {
    return this.proposals.approve(id);
  }

  rejectProposal(id: string, reason?: string) {
    return this.proposals.reject(id, reason);
  }
}
