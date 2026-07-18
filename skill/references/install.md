# Install & Run the MCP Server

Build once on any machine with Node.js 18+ (developed on v22/v26). The server
talks to a reachable Yamtrack instance over its public REST API.

```bash
git clone https://github.com/URD0TH/yamtrack-mcp
cd yamtrack-mcp
npm install        # install dependencies
npm run build      # compile src/ -> dist/ (strict TypeScript)
node dist/index.js --help
```

## Authentication

The server authenticates to Yamtrack with a **single static API key** — the same
token shown (with a copy button) and regenerable from **Account settings →
Integrations** in your Yamtrack instance. It never expires and is the only
credential the server accepts. The same key also authorizes the REST API and
integration webhooks (Plex/Jellyfin/Emby).

Read-only tools (`search_media`, `get_details`) work with no token.

### How the key reaches the server

Depends on the transport:

- **stdio** (default): pass it via `--token <token>` or the `YAMTRACK_API_KEY`
  env var.
- **http** (`--transport http`): send it as the `Authorization: Bearer <key>`
  header on each connection. If the header is absent, the server falls back to
  `--token` / `YAMTRACK_API_KEY`.

In both cases the server forwards the key as `Authorization: Bearer <key>` to
the Yamtrack REST API.

### CLI flags

| Option | Env var | Description |
|--------|---------|-------------|
| `--transport <type>` | – | `stdio` (default) or `http` |
| `--base-url <url>` | `YAMTRACK_BASE_URL` | API base URL. Default `http://localhost:8000/api` |
| `--token <token>` | `YAMTRACK_API_KEY` | Static API key (http fallback when no header) |
| `--port <n>` | – | Port for `http` transport. Default `8080` |
| `--username <user>` | – | Username (mints a JWT at startup) |
| `--password <pass>` | – | Password (mints a JWT at startup) |
| `--help` | – | Show usage |

> `YAMTRACK_BASE_URL` is the Yamtrack REST API (`/api`), **not** the `/mcp`
> endpoint (see `usage.md` for the two-ports gotcha).

## Keeping it alive

The bundled `supervise.sh` restarts the server if it crashes, up to
`YAMTRACK_MCP_MAX_RETRIES` attempts (default `5`, `YAMTRACK_MCP_RETRY_INTERVAL`
seconds between tries, default `2`). Each attempt and the final give-up are
logged to stderr; after the limit it exits. A clean exit (code `0`) is not
retried.

```bash
./supervise.sh --transport http --port 9123 --base-url http://10.0.0.5:8000/api
```

## Verify the build

```bash
npm run verify   # typecheck (tsc) + lint/format (biome) + tests (vitest)
```

Smoke test the server: `node dist/index.js --help`, then an MCP `initialize` +
`tools/list`.
