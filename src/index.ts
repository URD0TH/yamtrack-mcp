#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { YamtrackClient } from "./client.js";
import { registerTools } from "./tools.js";

const USAGE = `Yamtrack MCP server (stdio)

Usage:
  yamtrack-mcp [options]

Options:
  --base-url <url>     Yamtrack API base URL (default: http://localhost:8000/api
                        or YAMTRACK_BASE_URL env).
  --token <key>        Static API key (default: YAMTRACK_API_KEY env). This is the
                        per-account token from Account settings -> Integrations.
  --help               Show this help.

Auth: a single static API key authorizes both this server and the REST API.
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

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.error(USAGE);
    process.exit(0);
  }

  const client = new YamtrackClient({
    baseUrl: opts["base-url"],
    token: opts.token,
  });

  const server = new McpServer({ name: "yamtrack", version: "0.1.0" });
  registerTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Yamtrack MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
