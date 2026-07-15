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
  --token <token>      Static API token or JWT (default: YAMTRACK_JWT env).
  --username <user>    Username to mint a JWT at startup.
  --password <pass>    Password to mint a JWT at startup.
  --help               Show this help.

Auth precedence: --token/YAMTRACK_JWT, else --username/--password (auto-refresh).
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
    username: opts.username,
    password: opts.password,
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
