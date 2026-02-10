# Runtime Contract

OpenClaw Runtime follows a strict propose/approve/execute loop.
The runtime never authorizes actions on its own.

## Control Plane API

Base URL is provided by the embedding system. The runtime calls:

- `POST /steps/propose`
  - Request body: `StepProposal`
  - Response body: `ControlPlaneDecision`

- `POST /steps/report`
  - Request body: `StepResult`
  - Response body: empty (`204`) or confirmation payload

## Types

Canonical type definitions live in `ports/control-plane.ts`. Adapters and
the runtime depend on these port types to keep the control plane replaceable.

```
StepProposal {
  missionId: string
  stepId: string
  action: string
  payload: object
}

ControlPlaneDecision {
  approved: boolean
  reason?: string
}

StepResult {
  missionId: string
  stepId: string
  success: boolean
  output?: unknown
  error?: string
}
```

## Guarantees

- All steps are proposed before execution.
- Every approved step is reported with a result.
- Rejected steps are never executed.
