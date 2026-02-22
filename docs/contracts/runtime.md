# Runtime Contract

Claw Runtime follows a strict propose/approve/execute loop.
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

## Runtime Hooks (Plugins)

Runtime plugins can subscribe to:

- `beforeToolCall`
- `afterToolCall`
- `onMemoryWrite`
- `onRuntimeError`

## Runtime API (Control Plane -> Runtime)

The runtime can expose an HTTP API for remote control and approvals:

- `GET /health`
- `GET /status`
- `GET /proposals`
- `POST /approve/:id`
- `POST /reject/:id`
- `POST /run`
- `POST /shutdown`

If `RUNTIME_API_TOKEN` (or `runtimeApi.authToken`) is set, the runtime expects:

`Authorization: Bearer <token>`

## Runtime → Control Plane Protocol

See `docs/contracts/runtime-contract.md` for the versioned outbound protocol.
