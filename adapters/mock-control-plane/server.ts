import { createServer } from "node:http";
import { parse } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  ControlPlaneDecision,
  StepProposal,
  StepResult
} from "../../ports/control-plane";

export interface MockControlPlaneServerOptions {
  port?: number;
  approveAll?: boolean;
  approvalDecider?: (proposal: StepProposal) => ControlPlaneDecision;
}

export interface MockControlPlaneServerState {
  proposals: StepProposal[];
  results: StepResult[];
}

export interface MockControlPlaneServer {
  url: string;
  state: MockControlPlaneServerState;
  close: () => Promise<void>;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body ?? {});
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  return JSON.parse(raw) as T;
}

export async function startMockControlPlaneServer(
  options: MockControlPlaneServerOptions = {}
): Promise<MockControlPlaneServer> {
  const state: MockControlPlaneServerState = { proposals: [], results: [] };

  const server = createServer(async (req, res) => {
    const { pathname } = parse(req.url ?? "", true);

    if (req.method === "POST" && pathname === "/steps/propose") {
      const proposal = await readJson<StepProposal>(req);
      state.proposals.push(proposal);

      const decision = options.approvalDecider
        ? options.approvalDecider(proposal)
        : { approved: options.approveAll !== false };

      return sendJson(res, 200, decision);
    }

    if (req.method === "POST" && pathname === "/steps/report") {
      const result = await readJson<StepResult>(req);
      state.results.push(result);
      res.writeHead(204);
      res.end();
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  });

  const port = options.port ?? 0;

  await new Promise<void>((resolve) => {
    server.listen(port, resolve);
  });

  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;

  return {
    url: `http://localhost:${actualPort}`,
    state,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
  };
}

if (require.main === module) {
  startMockControlPlaneServer({ approveAll: true, port: 3001 })
    .then((serverInfo) => {
      console.log(`Mock control plane listening at ${serverInfo.url}`);
    })
    .catch((error) => {
      console.error("Failed to start mock control plane:", error);
      process.exit(1);
    });
}
