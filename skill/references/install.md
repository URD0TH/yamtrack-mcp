# Install & Run the MCP Server

Requires Node.js 18+. The server talks to a reachable Yamtrack instance over its
public REST API. Distributed via GitHub only (not npmjs.com).

## 1. Global install from git (recommended — no registry, no auth)

Installs the binary once in your PATH. Compiles TypeScript on install, then
runs instantly on every launch. No token required.

```bash
npm install -g github:URD0TH/yamtrack-mcp
```

After this, the `yamtrack-mcp` command is available everywhere.

> **Security note:** pin a tag or commit (`github:URD0TH/yamtrack-mcp#v0.1.0`)
> rather than the default branch, so a compromised push can't be pulled
> automatically.

## 2. npx (no install — good for testing)

Runs the package on the fly without installing. Compiles TypeScript on every
launch (slower startup). No token required.

```bash
npx github:URD0TH/yamtrack-mcp
```

## 3. GitHub Packages (scoped registry — requires a token)

```bash
echo "@urd0th:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=<GITHUB_TOKEN>" >> ~/.npmrc
npm install -g @urd0th/yamtrack-mcp        # latest
npm install -g @urd0th/yamtrack-mcp@0.1.0  # specific version
```

## Build from source

```bash
git clone https://github.com/URD0TH/yamtrack-mcp
cd yamtrack-mcp
npm install && npm run build
node dist/index.js --help
```

## Run

After installing globally (method 1):

```bash
yamtrack-mcp --transport stdio   # default, for local stdio clients
yamtrack-mcp --transport http    # starts HTTP server on :8080/mcp
yamtrack-mcp --help              # show all options
```

With npx (method 2, no install):

```bash
npx github:URD0TH/yamtrack-mcp --transport http
```

From source build (Build from source section):

```bash
node dist/index.js --transport http
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
> endpoint (see `references/usage.md` for the two-ports gotcha).

## Persistent service (PM2)

After installing globally, daemonize the server with auto-restart and log
management — no separate PM2 installation needed:

  yamtrack-mcp serve --port 9123 --base-url http://localhost:8000/api

Starts the server under PM2 (auto-restart on crash, logs to
`~/yamtrack-mcp-*.log`). Terminal se libera inmediatamente.

Admin subcommands (todo a través del mismo binario):

  yamtrack-mcp serve:status     # estado, uptime, restarts
  yamtrack-mcp serve:logs       # rutas de logs
  yamtrack-mcp serve:restart    # reiniciar
  yamtrack-mcp serve:stop       # detener y remover de PM2
  yamtrack-mcp serve:save       # guardar lista para persistencia en boot

Para auto-arranque al boot (requiere PM2 CLI global):

  npm install -g pm2
  pm2 startup                    # sigue las instrucciones
  yamtrack-mcp serve:save        # o pm2 save

## Keeping it alive (alternatives)

For stdio, the MCP client respawns the process on exit. For the `http`
transport, you can also use your own service manager (systemd, Docker
`restart:`). A `supervise.sh` helper that retries on crash is also available
in the repo for standalone runs.

## Verify the build

```bash
npm run verify   # typecheck (tsc) + lint/format (biome) + tests (vitest)
```

Smoke test the server: `node dist/index.js --help`, then an MCP `initialize` +
`tools/list`.
