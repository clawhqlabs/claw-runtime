const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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

function readSource(relPath) {
  return fs.readFileSync(path.join(__dirname, "..", relPath), "utf-8");
}

runTest("No side effects without approval", async () => {
  const controlPlane = new MockControlPlaneClient({ approveAll: false });
  const planner = new SimplePlanner([
    { action: "side-effect", payload: { value: 1 } }
  ]);

  let sideEffects = 0;
  const executor = new SimpleExecutor();
  executor.register("side-effect", async () => {
    sideEffects += 1;
    return { ok: true };
  });

  const agent = new AgentRuntime(
    { missionId: "test-no-side-effects", maxSteps: 2 },
    { planner, executor, controlPlane }
  );

  await agent.run();

  assert.equal(sideEffects, 0);
  assert.equal(controlPlane.getState().results.length, 0);
});

runTest("Planner cannot access tools directly (no tools import)", async () => {
  const plannerSource = readSource("core/planner.ts");
  const hasToolsImport = /from\s+["']\.\.\/tools\//.test(plannerSource);
  assert.equal(hasToolsImport, false, "planner should not import tools");
});

runTest("All tools live in executor layer only (no core tool imports)", async () => {
  const coreFiles = [
    "core/agent.ts",
    "core/planner.ts",
    "core/executor.ts",
    "core/memory.ts"
  ];

  const offenders = coreFiles.filter((file) => {
    const source = readSource(file);
    return /from\s+["']\.\.\/tools\//.test(source);
  });

  assert.deepEqual(offenders, []);
});

runTest("Runtime runs safely with permanent rejection", async () => {
  const controlPlane = new MockControlPlaneClient({ approveAll: false });

  let planned = 0;
  const planner = {
    async nextStep(context) {
      planned += 1;
      return {
        id: `step-${context.missionId}-${planned}`,
        action: "noop",
        payload: {},
        status: "pending"
      };
    }
  };

  const executor = new SimpleExecutor();
  executor.register("noop", async () => ({ ok: true }));

  const agent = new AgentRuntime(
    { missionId: "test-permanent-reject", maxSteps: 3 },
    { planner, executor, controlPlane }
  );

  await agent.run();

  assert.equal(planned, 3, "agent should stop at maxSteps");
  assert.equal(controlPlane.getState().results.length, 0);
});

runTest("Runtime contains no policy, billing, or tenant logic (keyword scan)", async () => {
  const coreFiles = [
    "core/agent.ts",
    "core/planner.ts",
    "core/executor.ts",
    "core/memory.ts",
    "adapters/http-control-plane/client.ts"
  ];

  const keywords = ["policy", "billing", "tenant"]; // simple heuristic
  const offenders = [];

  for (const file of coreFiles) {
    const source = readSource(file).toLowerCase();
    for (const keyword of keywords) {
      if (source.includes(keyword)) {
        offenders.push({ file, keyword });
      }
    }
  }

  assert.deepEqual(offenders, []);
});

runTest("Control Plane can be replaced without code change", async () => {
  const controlPlane = {
    async proposeStep() {
      return { approved: true };
    },
    async reportResult() {}
  };

  const planner = new SimplePlanner([
    { action: "noop", payload: {} }
  ]);

  const executor = new SimpleExecutor();
  executor.register("noop", async () => ({ ok: true }));

  const agent = new AgentRuntime(
    { missionId: "test-replaceable", maxSteps: 1 },
    { planner, executor, controlPlane }
  );

  await agent.run();
});

runTest("Execution loop matches documented contract order", async () => {
  const events = [];

  const controlPlane = {
    async proposeStep(proposal) {
      events.push(`propose:${proposal.stepId}`);
      return { approved: true };
    },
    async reportResult(result) {
      events.push(`report:${result.stepId}`);
    }
  };

  const planner = new SimplePlanner([
    { action: "noop", payload: {} }
  ]);

  const executor = new SimpleExecutor();
  executor.register("noop", async () => {
    events.push("execute:step-test-1");
    return { ok: true };
  });

  const agent = new AgentRuntime(
    { missionId: "test", maxSteps: 1 },
    { planner, executor, controlPlane }
  );

  await agent.run();

  assert.deepEqual(events, [
    "propose:step-test-1",
    "execute:step-test-1",
    "report:step-test-1"
  ]);
});
