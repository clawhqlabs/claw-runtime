export type ProposalStatus = "pending" | "approved" | "rejected" | "expired";

export interface Proposal {
  id: string;
  missionId: string;
  action: string;
  payload: Record<string, unknown>;
  status: ProposalStatus;
  createdAt: string;
  decidedAt?: string;
  decisionReason?: string;
}

export interface ProposalDecision {
  approved: boolean;
  reason?: string;
}

export interface ProposalStore {
  create(proposal: Omit<Proposal, "status" | "createdAt">): Proposal;
  list(): Proposal[];
  get(id: string): Proposal | undefined;
  approve(id: string): Proposal | undefined;
  reject(id: string, reason?: string): Proposal | undefined;
  awaitDecision(id: string): Promise<ProposalDecision>;
}

interface PendingDecision {
  resolve: (decision: ProposalDecision) => void;
  reject: (error: Error) => void;
}

export class InMemoryProposalStore implements ProposalStore {
  private readonly timeoutMs?: number;
  private readonly autoDecision?: "approve" | "reject";
  private readonly proposals = new Map<string, Proposal>();
  private readonly pending = new Map<string, PendingDecision>();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(options?: { timeoutMs?: number; autoDecision?: "approve" | "reject" }) {
    this.timeoutMs = options?.timeoutMs;
    this.autoDecision = options?.autoDecision;
  }

  create(proposal: Omit<Proposal, "status" | "createdAt">): Proposal {
    const record: Proposal = {
      ...proposal,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    this.proposals.set(record.id, record);
    this.armTimeout(record.id);
    return record;
  }

  list(): Proposal[] {
    return Array.from(this.proposals.values());
  }

  get(id: string): Proposal | undefined {
    return this.proposals.get(id);
  }

  approve(id: string): Proposal | undefined {
    const proposal = this.proposals.get(id);
    if (!proposal || proposal.status !== "pending") {
      return proposal;
    }
    proposal.status = "approved";
    proposal.decidedAt = new Date().toISOString();
    proposal.decisionReason = undefined;

    const pending = this.pending.get(id);
    if (pending) {
      pending.resolve({ approved: true });
      this.pending.delete(id);
    }

    this.clearTimeout(id);
    return proposal;
  }

  reject(id: string, reason?: string): Proposal | undefined {
    const proposal = this.proposals.get(id);
    if (!proposal || proposal.status !== "pending") {
      return proposal;
    }
    proposal.status = "rejected";
    proposal.decidedAt = new Date().toISOString();
    proposal.decisionReason = reason;

    const pending = this.pending.get(id);
    if (pending) {
      pending.resolve({ approved: false, reason });
      this.pending.delete(id);
    }

    this.clearTimeout(id);
    return proposal;
  }

  async awaitDecision(id: string): Promise<ProposalDecision> {
    const proposal = this.proposals.get(id);
    if (!proposal) {
      throw new Error(`Unknown proposal: ${id}`);
    }

    if (proposal.status === "approved") {
      return { approved: true };
    }

    if (proposal.status === "rejected") {
      return { approved: false, reason: proposal.decisionReason };
    }

    if (proposal.status === "expired") {
      return { approved: false, reason: proposal.decisionReason ?? "expired" };
    }

    return new Promise<ProposalDecision>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  private armTimeout(id: string): void {
    if (!this.timeoutMs) {
      return;
    }
    const timer = setTimeout(() => {
      const proposal = this.proposals.get(id);
      if (!proposal || proposal.status !== "pending") {
        return;
      }

      if (this.autoDecision === "approve") {
        proposal.status = "approved";
        proposal.decidedAt = new Date().toISOString();
        proposal.decisionReason = "auto-approved";
        const pending = this.pending.get(id);
        if (pending) {
          pending.resolve({ approved: true, reason: proposal.decisionReason });
          this.pending.delete(id);
        }
      } else if (this.autoDecision === "reject") {
        proposal.status = "rejected";
        proposal.decidedAt = new Date().toISOString();
        proposal.decisionReason = "auto-rejected";
        const pending = this.pending.get(id);
        if (pending) {
          pending.resolve({ approved: false, reason: proposal.decisionReason });
          this.pending.delete(id);
        }
      } else {
        proposal.status = "expired";
        proposal.decidedAt = new Date().toISOString();
        proposal.decisionReason = "expired";
        const pending = this.pending.get(id);
        if (pending) {
          pending.resolve({ approved: false, reason: proposal.decisionReason });
          this.pending.delete(id);
        }
      }

      this.clearTimeout(id);
    }, this.timeoutMs);

    this.timers.set(id, timer);
  }

  private clearTimeout(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
