const assert = require("node:assert/strict");
const { AgentRuntime } = require("../dist/core/agent");
const { SimplePlanner } = require("../dist/core/planner");
const { SimpleExecutor } = require("../dist/core/executor");
const {
  MockControlPlaneClient
} = require("../dist/adapters/mock-control-plane/client");

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

runTest("reject-all prevents execution", async () => {
  const controlPlane = new MockControlPlaneClient({ approveAll: false });

  const planner = new SimplePlanner([
    { action: "should-not-run", payload: { value: 1 } }
  ]);

  const executor = new SimpleExecutor();
  let calls = 0;
  executor.register("should-not-run", async () => {
    calls += 1;
    return { ran: true };
  });

  const agent = new AgentRuntime(
    { missionId: "test-reject-all", maxSteps: 3 },
    { planner, executor, controlPlane }
  );

  await agent.run();

  assert.equal(calls, 0, "executor should not run without approval");
  const state = controlPlane.getState();
  assert.equal(state.results.length, 0, "no results should be reported");
});

runTest("mixed approvals never execute rejected step", async () => {
  const controlPlane = new MockControlPlaneClient({
    approvalDecider: (proposal) => ({
      approved: proposal.action !== "denied"
    })
  });

  const planner = new SimplePlanner([
    { action: "denied", payload: {} },
    { action: "allowed", payload: { value: 42 } }
  ]);

  const executor = new SimpleExecutor();
  let allowedCalls = 0;

  executor.register("denied", async () => {
    throw new Error("should never run denied action");
  });

  executor.register("allowed", async () => {
    allowedCalls += 1;
    return { ok: true };
  });

  const agent = new AgentRuntime(
    { missionId: "test-mixed", maxSteps: 5 },
    { planner, executor, controlPlane }
  );

  await agent.run();

  assert.equal(allowedCalls, 1, "approved action should execute once");

  const state = controlPlane.getState();
  const deniedStepId = state.proposals.find(
    (proposal) => proposal.action === "denied"
  )?.stepId;

  const deniedReported = state.results.some(
    (result) => result.stepId === deniedStepId
  );

  assert.equal(deniedReported, false, "rejected step should not be reported");
});
