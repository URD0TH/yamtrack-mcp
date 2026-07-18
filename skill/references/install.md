# Install & Run the MCP Server

Requires Node.js 18+. The server talks to a reachable Yamtrack instance over its
public REST API. Distributed via GitHub only (not npmjs.com).

**Recommended — run straight from the repo (no registry, no auth):**

```bash
npx github:URD0TH/yamtrack-mcp#v0.1.0 --help
```

The `prepare` script compiles `src/` to `dist/` on install. Alternatively, use
GitHub Packages (`@urd0th/yamtrack-mcp`, requires a GitHub token with
`read:packages`) or build from a local clone:

```bash
git clone https://github.com/URD0TH/yamtrack-mcp
cd yamtrack-mcp
npm install && npm run build
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

> **"Bearer" is how the key is sent, not a separate token.** There is one
> credential. In **stdio**, put the raw key in `YAMTRACK_API_KEY` / `--token`
> — do **not** write `Bearer`; the server adds the prefix itself. In **http**,
> the client sends `Authorization: Bearer <key>` and the server forwards that
> same value. The `<key>` is identical either way.
>
> ```json
> // stdio config — no "Bearer"
> "env": { "YAMTRACK_API_KEY": "<token>" }
> // http config — with "Bearer"
> "headers": { "Authorization": "Bearer <token>" }
> ```

### CLI flags

| Option | Env var | Description |
|--------|---------|-------------|
| `--transport <type>` | – | `stdio` (default) or `http` |
| `--base-url <url>` | `YAMTRACK_BASE_URL` | API base URL. Default `http://localhost:8000/api` |
| `--token <token>` | `YAMTRACK_API_KEY` | Static API key (http fallback when no header) |
| `--port <n>` | – | Port for `http` transport. Default `8080` |
| `--help` | – | Show usage |

> `YAMTRACK_BASE_URL` is the Yamtrack REST API (`/api`), **not** the `/mcp`
> endpoint (see `usage.md` for the two-ports gotcha).

## Keeping it alive

For stdio, the MCP client respawns the process on exit. For the `http`
transport, let your service manager (systemd, Docker `restart:`, pm2) restart
it. A `supervise.sh` helper that retries on crash is also available in the repo
for standalone runs.

## Verify the build

```bash
npm run verify   # typecheck (tsc) + lint/format (biome) + tests (vitest)
```

Smoke test the server: `node dist/index.js --help`, then an MCP `initialize` +
`tools/list`.
