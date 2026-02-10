export interface StepProposal {
  missionId: string;
  stepId: string;
  action: string;
  payload: Record<string, unknown>;
}

export interface StepResult {
  missionId: string;
  stepId: string;
  success: boolean;
  output?: unknown;
  error?: string;
}

export interface ControlPlaneDecision {
  approved: boolean;
  reason?: string;
}

export interface ControlPlanePort {
  proposeStep(proposal: StepProposal): Promise<ControlPlaneDecision>;
  reportResult(result: StepResult): Promise<void>;
}
