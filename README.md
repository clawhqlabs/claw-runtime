# OpenClaw Runtime

OpenClaw Runtime is an open-source execution runtime for autonomous agents.

It is designed to handle **reasoning and execution only**, while delegating
all authority, governance, and safety decisions to an external control plane.

> OpenClaw Runtime is autonomous in thinking,  
> but never autonomous in authority.

---

## What Is This?

OpenClaw Runtime provides a minimal, explicit execution loop for agents that:

- reason about a mission
- propose actions
- wait for external approval
- execute approved actions
- report results

It does **not** decide what is allowed.
It does **not** enforce policy or billing.
It does **not** manage users or tenants.

This runtime is intended to be embedded into larger systems that require
controlled and observable agent behavior.

---

## Runtime Execution Model

OpenClaw Runtime follows a strictly controlled execution loop.
The runtime is autonomous in reasoning, but never autonomous in authority.

All agent behavior in OpenClaw Runtime must conform to the following loop:

```
while mission not finished:
think()
propose(step)
wait for decision
if approved:
execute(step)
report(result)
else:
adjust plan
```

### Principles

- The runtime can **reason freely**, but cannot act freely.
- Every meaningful action must be **explicitly proposed**.
- No step is executed without **external approval**.
- Rejected steps must be **adapted**, not retried blindly.
- The runtime never evaluates policy, quota, or risk on its own.

This model ensures that autonomous agents remain observable, controllable,
and safe to operate in production environments.

---

## Responsibilities

OpenClaw Runtime is responsible for:

- Reasoning about missions using LLMs
- Planning steps to achieve a mission goal
- Proposing steps to an external system
- Executing approved steps
- Reporting execution results and events
- Reading and writing within a local workspace

---

## Non-Responsibilities

By design, OpenClaw Runtime does **not**:

- Evaluate permissions or policies
- Enforce billing or quotas
- Classify risk or compliance
- Manage tenants, users, or roles
- Control mission lifecycle decisions
- Provide dashboards or approval UIs

If a decision affects safety, cost, or authority,
it must not live inside the runtime.

---

## Control Plane Assumption

OpenClaw Runtime assumes the presence of an external system
(referred to as a “control plane”) that:

- receives step proposals
- approves or rejects actions
- governs mission lifecycle

The runtime communicates with this system via a minimal,
replaceable interface (typically HTTP).

Any system implementing this interface can drive OpenClaw Runtime.

---

## Project Structure

openclaw-runtime/
├── core/ # agent loop, planner, executor
├── adapters/ # control plane adapters (HTTP, mock)
├── tools/ # filesystem, shell, network tools
├── docs/ # runtime contracts
├── cli/ # command-line interface
└── examples/ # minimal usage examples

---

## Design Goals

- Explicit execution flow
- No hidden authority
- Minimal surface area
- Replaceable control plane
- Production-oriented behavior

---

## Non-Goals

- Building a full agent platform
- Providing governance or billing logic
- Maximizing autonomy at all costs
- Abstracting away execution control

OpenClaw Runtime is intentionally opinionated and incomplete.

---

## License

Apache License 2.0

This project is open source and intended to be embedded,
extended, and integrated into larger systems.

---

## Status

OpenClaw Runtime is under active development.
The execution model is considered stable,
while internal implementations may evolve.
