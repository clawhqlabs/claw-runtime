import { createServer } from "node:http";
import { parse } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RuntimeService } from "../core/runtime-service";
import { ErrorCode, type Response } from "./types";

export interface RuntimeApiConfig {
  port: number;
  authToken?: string;
}

function sendJson<T>(res: ServerResponse, status: number, body: Response<T>): void {
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
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}

function isAuthorized(req: IncomingMessage, token?: string): boolean {
  if (!token) {
    return true;
  }
  const header = req.headers.authorization ?? "";
  return header === `Bearer ${token}`;
}

export function startRuntimeApiServer(
  config: RuntimeApiConfig,
  runtime: RuntimeService,
  onShutdown?: () => void
): void {
  const server = createServer(async (req, res) => {
    if (!isAuthorized(req, config.authToken)) {
      return sendJson(res, 401, {
        ok: false,
        error: { code: ErrorCode.Unauthorized, message: "Unauthorized" }
      });
    }

    const { pathname } = parse(req.url ?? "", true);

    if (req.method === "GET" && pathname === "/health") {
      return sendJson(res, 200, { ok: true, data: { status: "ok" } });
    }

    if (req.method === "GET" && pathname === "/status") {
      return sendJson(res, 200, { ok: true, data: runtime.getStatus() });
    }

    if (req.method === "GET" && pathname === "/proposals") {
      return sendJson(res, 200, {
        ok: true,
        data: { proposals: runtime.listProposals() }
      });
    }

    if (req.method === "POST" && pathname?.startsWith("/approve/")) {
      const id = pathname.replace("/approve/", "");
      const proposal = runtime.approveProposal(id);
      if (!proposal) {
        return sendJson(res, 404, {
          ok: false,
          error: { code: ErrorCode.NotFound, message: "Proposal not found" }
        });
      }
      return sendJson(res, 200, { ok: true, data: proposal });
    }

    if (req.method === "POST" && pathname?.startsWith("/reject/")) {
      const id = pathname.replace("/reject/", "");
      const body = await readJson<{ reason?: string }>(req);
      const proposal = runtime.rejectProposal(id, body.reason);
      if (!proposal) {
        return sendJson(res, 404, {
          ok: false,
          error: { code: ErrorCode.NotFound, message: "Proposal not found" }
        });
      }
      return sendJson(res, 200, { ok: true, data: proposal });
    }

    if (req.method === "POST" && pathname === "/run") {
      void runtime.run();
      return sendJson(res, 202, { ok: true, data: { status: "started" } });
    }

    if (req.method === "POST" && pathname === "/shutdown") {
      sendJson(res, 200, { ok: true, data: { status: "shutting-down" } });
      if (onShutdown) {
        onShutdown();
      }
      return;
    }

    return sendJson(res, 404, {
      ok: false,
      error: { code: ErrorCode.NotFound, message: "Not found" }
    });
  });

  server.listen(config.port, () => {
    console.log(`Runtime API listening on ${config.port}`);
  });
}
