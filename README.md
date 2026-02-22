# Claw Runtime

Claw Runtime is an open-source execution runtime for autonomous agents.

It is designed to handle **reasoning and execution only**, while delegating
all authority, governance, and safety decisions to an external control plane.

> Claw Runtime is autonomous in thinking,  
> but never autonomous in authority.

---

## What Is This?

Claw Runtime provides a minimal, explicit execution loop for agents that:

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

Claw Runtime follows a strictly controlled execution loop.
The runtime is autonomous in reasoning, but never autonomous in authority.

All agent behavior in Claw Runtime must conform to the following loop:

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

Claw Runtime is responsible for:

- Reasoning about missions using LLMs
- Planning steps to achieve a mission goal
- Proposing steps to an external system
- Executing approved steps
- Reporting execution results and events
- Reading and writing within a local workspace

---

## Non-Responsibilities

By design, Claw Runtime does **not**:

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

Claw Runtime assumes the presence of an external system
(referred to as a “control plane”) that:

- receives step proposals
- approves or rejects actions
- governs mission lifecycle

The runtime communicates with this system via a minimal,
replaceable interface (typically HTTP).

Any system implementing this interface can drive Claw Runtime.

---

## Project Structure

Claw Runtime is organized around a strict separation of concerns.
Each top-level directory has a clearly defined responsibility.

```
claw-runtime/
├── core/
├── ports/
├── adapters/
├── api/
├── plugins/
├── tools/
├── cli/
├── docs/
├── test/
```

### `core/` — Runtime Core

The runtime core contains the execution logic of the agent.

It is responsible for:

- the agent execution loop
- planning and step orchestration
- execution control and result reporting
- in-memory state management

The core:

- **does not** know how approvals are decided
- **does not** perform any I/O directly
- **does not** contain policy, billing, or tenant logic

### `api/` — Runtime Control API

The runtime can expose an HTTP API for control planes to:

- query status
- approve/reject proposals
- start/stop execution

### `plugins/` — Runtime Plugins

Plugins extend runtime behavior via hooks (before/after tool calls, memory writes,
runtime errors) without embedding policy directly in the core.

This layer depends only on abstract ports, never on concrete adapters.

---

### `ports/` — Runtime Contracts

The `ports` directory defines the **explicit contracts** between the runtime
and external systems.

These interfaces represent the _only_ allowed way for the runtime to interact
with the outside world.

Examples:

- Control Plane interface
- Step proposal and decision schemas

Ports:

- contain no implementation
- define runtime authority boundaries
- act as the “constitution” of the runtime

If a dependency is not expressed as a port, the runtime must not depend on it.

---

### `adapters/` — External Integrations

Adapters implement the contracts defined in `ports/`.

They translate runtime-level intents into concrete I/O operations, such as:

- HTTP requests
- mock or local control plane behavior

Adapters:

- may perform serialization, networking, and retries
- must not make decisions or apply policy
- must not execute steps autonomously

Included adapters:

- `http-control-plane/` — reference HTTP-based control plane adapter
- `mock-control-plane/` — local mock adapter for testing and development

Adapters are replaceable and optional.

---

### `tools/` — Execution Primitives

The `tools` directory contains low-level execution primitives used by the executor.

Examples:

- filesystem access
- shell command execution
- network utilities

Tools:

- are only callable by the executor
- must never be invoked directly by planners or agent logic
- represent all possible side effects of the runtime

All side effects must pass through this layer.

---

### `cli/` — Reference CLI Runner

The CLI provides a minimal, reference way to run the runtime locally.

It is responsible for:

- loading configuration
- wiring together core, ports, and adapters
- starting the agent runtime

The CLI:

- is not part of the runtime core
- serves as an example, not a platform
- may be replaced or omitted in embedded deployments

---

### `docs/` — Documentation & Contracts

Documentation related to runtime behavior and guarantees.

Includes:

- formal runtime execution contracts
- design constraints and invariants

This directory documents what the runtime **must** and **must not** do.

---

### `test/` — Runtime Validation

Tests in this directory verify runtime invariants, not agent intelligence.

They focus on:

- preventing execution without approval
- enforcing control plane authority
- validating execution boundaries

If a test in this directory fails, the runtime is considered unsafe.

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

Claw Runtime is intentionally opinionated and incomplete.

---

## License

Apache License 2.0

This project is open source and intended to be embedded,
extended, and integrated into larger systems.

---

## Status

Claw Runtime is under active development.
The execution model is considered stable,
while internal implementations may evolve.
