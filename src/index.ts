#!/usr/bin/env node
import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { YamtrackClient } from "./client.js";
import { registerTools } from "./tools.js";

const USAGE = `Yamtrack MCP server

Usage:
  yamtrack-mcp [options]

Options:
  --transport <type>  Transport: "stdio" (default) or "http".
  --base-url <url>    Yamtrack API base URL (default: http://localhost:8000/api
                      or YAMTRACK_BASE_URL env).
  --token <key>       Static API key (default: YAMTRACK_API_KEY env). This is the
                      per-account token from Account settings -> Integrations.
                      For "http" transport this is the fallback when a request
                      does not send its own Authorization header.
  --port <n>          Port for "http" transport (default: 8080).
  --help              Show this help.

Auth: a static API key authorizes both this server and the REST API.
  - stdio: key from --token / YAMTRACK_API_KEY (or env).
  - http: key from the incoming "Authorization: Bearer <key>" header, falling
    back to --token / YAMTRACK_API_KEY when absent.
Read-only tools (search_media, get_details) work without authentication.
`;

function parseArgs(argv: string[]): Record<string, string> {
  const opts: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      opts[key] = next;
      i++;
    } else {
      opts[key] = "true";
    }
  }
  return opts;
}

function bearerFrom(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match ? match[1].trim() : undefined;
}

function createMcpServer(client: YamtrackClient): McpServer {
  const server = new McpServer({ name: "yamtrack", version: "0.1.0" });
  registerTools(server, client);
  return server;
}

export function startHttpServer(opts: {
  baseUrl: string;
  token?: string;
  port: number;
}): http.Server {
  const server = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/mcp") {
      try {
        const token = bearerFrom(req.headers.authorization) ?? opts.token;
        const client = new YamtrackClient({ baseUrl: opts.baseUrl, token });
        const mcp = createMcpServer(client);
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });
        res.on("close", () => {
          transport.close().catch(() => {});
          mcp.close().catch(() => {});
        });
        await mcp.connect(transport);
        await transport.handleRequest(req, res);
      } catch {
        if (!res.headersSent) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32700, message: "bad request" },
              id: null,
            }),
          );
        }
      }
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(opts.port, () => {
    console.error(`Yamtrack MCP server (http) listening on :${opts.port}/mcp`);
  });
  return server;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.error(USAGE);
    process.exit(0);
  }

  const baseUrl = (
    opts["base-url"] ??
    process.env.YAMTRACK_BASE_URL ??
    "http://localhost:8000/api"
  ).replace(/\/+$/, "");
  const startupToken = opts.token ?? process.env.YAMTRACK_API_KEY;

  const transport = opts.transport ?? "stdio";
  if (transport === "http") {
    const port = Number.parseInt(opts.port ?? "8080", 10);
    startHttpServer({ baseUrl, token: startupToken, port });
    return;
  }

  const client = new YamtrackClient({ baseUrl, token: startupToken });
  const server = createMcpServer(client);

  const stdio = new StdioServerTransport();
  await server.connect(stdio);
  console.error("Yamtrack MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
