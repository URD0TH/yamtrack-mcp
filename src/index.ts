#!/usr/bin/env node
import http from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import pm2 from "pm2";
import { YamtrackClient } from "./client.js";
import { registerTools } from "./tools.js";

const pm2Connect = promisify(pm2.connect.bind(pm2));
const pm2Disconnect = promisify(pm2.disconnect.bind(pm2));
function pm2Start(opts: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    pm2.start(opts, (err: unknown) => (err ? reject(err) : resolve()));
  });
}
const pm2List = promisify(pm2.list.bind(pm2));
const pm2Describe = promisify(pm2.describe.bind(pm2));
const pm2Restart = promisify(pm2.restart.bind(pm2));
const pm2Stop = promisify(pm2.stop.bind(pm2));
const pm2Delete = promisify(pm2.delete.bind(pm2));
const pm2Dump = promisify(pm2.dump.bind(pm2));

const USAGE = `Yamtrack MCP server

Usage:
  yamtrack-mcp [options]
  yamtrack-mcp serve [options]

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

Subcommands:
  serve             Start as a persistent HTTP service via PM2.
                    Auto-restarts on crash. Logs to ~/yamtrack-mcp-*.log.
                    Run "yamtrack-mcp serve --help" for serve options.

  serve:status      Show process status.
  serve:logs        Show log file paths.
  serve:restart     Restart the server.
  serve:stop        Stop and remove from PM2.
  serve:save        Save process list for PM2 resurrect on boot.

Auth: a static API key authorizes both this server and the REST API.
  - stdio: key from --token / YAMTRACK_API_KEY (or env).
  - http: key from the incoming "Authorization: Bearer <key>" header, falling
    back to --token / YAMTRACK_API_KEY when absent.
Read-only tools (search_media, get_details) work without authentication.
`;

const SERVE_USAGE = `yamtrack-mcp serve — persistent HTTP service via PM2

Usage:
  yamtrack-mcp serve [options]

Options:
  --port <n>        Port (default: 8080).
  --base-url <url>  Yamtrack API (default: http://localhost:8000/api or
                    YAMTRACK_BASE_URL).
  --token <key>     Static API key (default: YAMTRACK_API_KEY env).
  --help            Show this help.

Admin subcommands (no --flags needed):
  serve:status      Show process status.
  serve:logs        Show log file paths.
  serve:restart     Restart the server.
  serve:stop        Stop and remove from PM2.
  serve:save        Save process list for boot persistence.

Examples:
  yamtrack-mcp serve --port 9123 --base-url http://localhost:8000/api
  yamtrack-mcp serve:status
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
  const match = /^Bearer\s+(\S+)$/i.exec(value.trim());
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
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
      return;
    }
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

  const shutdown = () => {
    console.error("Shutting down...");
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return server;
}

async function handleServe(opts: Record<string, string>): Promise<void> {
  if (opts.transport && opts.transport !== "http") {
    console.error("serve requires --transport http (or omit it)");
    process.exit(1);
  }

  const port = Number.parseInt(opts.port ?? "8080", 10);
  const baseUrl = (
    opts["base-url"] ??
    process.env.YAMTRACK_BASE_URL ??
    "http://localhost:8000/api"
  ).replace(/\/$/, "");
  const token = opts.token ?? process.env.YAMTRACK_API_KEY;
  const script = process.argv[1];

  if (!token) {
    console.error("Warning: no token provided — only read-only tools will work.");
    console.error("Pass --token <key> or set YAMTRACK_API_KEY.");
  }

  const pm2Args = [
    "--transport",
    "http",
    "--port",
    String(port),
    "--base-url",
    baseUrl,
  ];
  if (token) pm2Args.push("--token", token);

  await pm2Connect();
  await pm2Start({
    name: "yamtrack-mcp",
    script,
    args: pm2Args,
    max_restarts: 10,
    restart_delay: 2000,
    error_file: join(homedir(), "yamtrack-mcp-err.log"),
    out_file: join(homedir(), "yamtrack-mcp-out.log"),
    merge_logs: true,
  });
  await pm2Disconnect();

  console.error(`yamtrack-mcp serve started on :${port}/mcp`);
  console.error("Manage: yamtrack-mcp serve:status|logs|restart|stop|save");
}

async function handleServeStatus(): Promise<void> {
  await pm2Connect();
  const list = await pm2List();
  await pm2Disconnect();

  const proc = list.find((p: { name?: string }) => p.name === "yamtrack-mcp");
  if (!proc) {
    console.error("yamtrack-mcp is not running");
    return;
  }
  console.error(`name:     ${proc.name}`);
  console.error(`status:   ${proc.pm2_env?.status}`);
  console.error(`pid:      ${proc.pid}`);
  const uptime = proc.pm2_env?.pm_uptime
    ? `${Math.floor((Date.now() - proc.pm2_env.pm_uptime) / 1000)}s`
    : "N/A";
  console.error(`uptime:   ${uptime}`);
  console.error(`restarts: ${proc.pm2_env?.restart_time ?? 0}`);
}

async function handleServeLogs(): Promise<void> {
  await pm2Connect();
  const list = await pm2Describe("yamtrack-mcp");
  await pm2Disconnect();

  const proc = list[0];
  if (!proc) {
    console.error("yamtrack-mcp is not running");
    return;
  }
  console.error(`out: ${proc.pm2_env?.pm_out_log_path ?? "N/A"}`);
  console.error(`err: ${proc.pm2_env?.pm_err_log_path ?? "N/A"}`);
}

async function handleServeRestart(): Promise<void> {
  await pm2Connect();
  await pm2Restart("yamtrack-mcp");
  await pm2Disconnect();
  console.error("yamtrack-mcp restarted");
}

async function handleServeStop(): Promise<void> {
  await pm2Connect();
  await pm2Stop("yamtrack-mcp");
  await pm2Delete("yamtrack-mcp");
  await pm2Dump();
  await pm2Disconnect();
  console.error("yamtrack-mcp stopped");
}

async function handleServeSave(): Promise<void> {
  await pm2Connect();
  await pm2Dump();
  await pm2Disconnect();
  console.error("Process list saved (resurrect on pm2 restart)");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const subcommand = args[0] && !args[0].startsWith("--") ? args[0] : undefined;
  const opts = parseArgs(subcommand ? args.slice(1) : args);

  if (opts.help) {
    console.error(subcommand === "serve" ? SERVE_USAGE : USAGE);
    process.exit(0);
  }

  if (subcommand === "serve") {
    await handleServe(opts);
    return;
  }
  if (subcommand === "serve:status") {
    await handleServeStatus();
    return;
  }
  if (subcommand === "serve:logs") {
    await handleServeLogs();
    return;
  }
  if (subcommand === "serve:restart") {
    await handleServeRestart();
    return;
  }
  if (subcommand === "serve:stop") {
    await handleServeStop();
    return;
  }
  if (subcommand === "serve:save") {
    await handleServeSave();
    return;
  }

  if (subcommand) {
    console.error(`Unknown subcommand: ${subcommand}\n`);
    console.error(USAGE);
    process.exit(1);
  }

  const baseUrl = (
    opts["base-url"] ??
    process.env.YAMTRACK_BASE_URL ??
    "http://localhost:8000/api"
  ).replace(/\/$/, "");
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
