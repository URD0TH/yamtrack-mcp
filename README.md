# yamtrack-mcp

[![Security Policy](https://img.shields.io/badge/Security-Policy-blue)](https://github.com/URD0TH/yamtrack-mcp/security/policy)

[Leer en español](README.es.md)

A standalone [Model Context Protocol](https://modelcontextprotocol.org) server
(**stdio** or **http** transport, TypeScript) that exposes the [Yamtrack](https://github.com/URD0TH/Yamtrack)
REST API as tools for LLMs (Claude Desktop, OpenCode, VS Code, Hermes, etc.).

It runs on **any machine** and talks to a Yamtrack instance over its public
REST API. No Django code required.

## Requirements

- Node.js 18+ (developed on v22/v26)
- A reachable Yamtrack instance (e.g. `http://localhost:8000` or your hosted URL)
- An API token for that instance (from Account settings → Integrations)

## Install

Distributed via **GitHub only** — it is **not** published to npmjs.com, so
`npx yamtrack-mcp` (the public unscoped name) will **not** work. Choose one of
the two methods below.

### 1. Global install from release tarball (recommended)

Download the pre-built tarball from the [latest release](https://github.com/URD0TH/yamtrack-mcp/releases/latest)
and install globally:

```bash
npm install -g https://github.com/URD0TH/yamtrack-mcp/releases/latest/download/urd0th-yamtrack-mcp-0.1.2.tgz
```

After this, the `yamtrack-mcp` command is available everywhere.

Or skip the install and run directly with npx:

```bash
npx github:URD0TH/yamtrack-mcp
```

> **Security note:** pin an explicit version (change `0.1.2` to the tag you
> want) rather than relying on `latest`, so a compromised push can't be pulled
> automatically.

### 2. GitHub Packages (scoped registry — requires a token)

The `Publish` workflow pushes `@urd0th/yamtrack-mcp` to GitHub Packages on each
`v*` tag. **GitHub Packages requires authentication even for public packages**,
so consumers must configure the `@urd0th` scope and a GitHub token with
`read:packages` before installing:

```bash
echo "@urd0th:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=<GITHUB_TOKEN>" >> ~/.npmrc
npm install -g @urd0th/yamtrack-mcp        # latest
npm install -g @urd0th/yamtrack-mcp@0.1.0  # specific version
```

> **Security note:** pin an explicit version (`@0.1.0`) rather than `@latest`.
> Without the `.npmrc` entries above, `npm install -g @urd0th/yamtrack-mcp`
> returns 401.

## Build from source

```bash
git clone https://github.com/URD0TH/yamtrack-mcp
cd yamtrack-mcp
npm install        # install dependencies
npm run build      # compile src/ -> dist/ (strict TypeScript)
```

## Run

After installing globally (method 1 or 2):

```bash
yamtrack-mcp --transport http --port 8080                                # foreground (dev / testing)
yamtrack-mcp --transport http --port 8080 --base-url http://url:port/api # foreground, custom instance
yamtrack-mcp serve --port 9123                                              # daemonized via PM2 (production)
yamtrack-mcp serve --port 9123 --base-url http://url:port/api              # daemonized, custom instance
yamtrack-mcp --transport stdio                 # default, for local stdio clients
yamtrack-mcp serve:status                      # check server status
yamtrack-mcp serve:restart                     # restart
yamtrack-mcp serve:stop                        # stop
yamtrack-mcp serve:logs                        # log file paths
yamtrack-mcp --help                            # show all options
```

> **`serve` vs without `serve`:** Without `serve` the process runs in the
> foreground — use it for development, testing, or with your own supervisor
> (systemd, Docker `restart:`). With `serve` the process daemonizes via PM2
> with auto-restart and log management (no separate PM2 install required).

With npx (no install):

```bash
npx github:URD0TH/yamtrack-mcp --transport http
```

From source build (Build from source section):

```bash
node dist/index.js --transport http
```

## Authentication

The server authenticates to Yamtrack with a **single static account API key**
(from Account settings → Integrations), passed via `--token <token>` or the
`YAMTRACK_API_KEY` env var. It never expires and is the only credential the
server accepts.

| Option | Env var | Description |
|--------|---------|-------------|
| `--transport <type>` | – | `stdio` (default) or `http` |
| `--base-url <url>` | `YAMTRACK_BASE_URL` | API base URL. Default `http://localhost:8000/api` |
| `--token <token>` | `YAMTRACK_API_KEY` | Static API key (http fallback when no header) |
| `--port <n>` | – | Port for `http` transport. Default `8080` |
| `--help` | – | Show usage |

Read-only tools (`search_media`, `get_details`) work **without** authentication.

> **One token, two ways to pass it.** There is a **single** credential — your
> Yamtrack account API key. "Bearer" is just *how* it's sent, not a different
> token.
> - **stdio:** set the raw key in `YAMTRACK_API_KEY` (or `--token`). Do **not**
>   write `Bearer` — the server adds the `Bearer ` prefix for you when it calls
>   the REST API.
>   ```json
>   "env": { "YAMTRACK_API_KEY": "<token>" }
>   ```
> - **http:** the client sends `Authorization: Bearer <token>` and the server
>   forwards that same key. Here you **do** write `Bearer`.
>   ```json
>   "headers": { "Authorization": "Bearer <token>" }
>   ```
> The `<token>` value is identical in both cases.

### HTTP transport

With `--transport http` the server listens on `POST /mcp` (StreamableHTTP,
stateless). Each connection authenticates via the `Authorization: Bearer
<token>` header it receives, falling back to `--token` / `YAMTRACK_API_KEY`
when the header is absent. The token is then forwarded as a Bearer token to
the Yamtrack REST API, exactly like the stdio transport.

> **Security note:** the HTTP transport has no built-in TLS or rate limiting.
> Bind it to `localhost` and expose it only behind a reverse proxy with
> HTTPS/authentication — never directly to the internet.

## Tools

All tools map 1:1 to the REST API documented in
[wiki/API.md](https://github.com/FuzzyGrim/Yamtrack/wiki/API).

| Tool | REST endpoint |
|------|---------------|
| `search_media` | `GET /search/` |
| `get_details` | `GET /details/<source>/<type>/<id>/` (+ season) |
| `list_tracked_media` | `GET /media/<type>/` |
| `get_home` | `GET /home/` |
| `get_history` | `GET /history/<source>/<type>/<id>/` |
| `create_entry` | `POST /media/<type>/create/` |
| `manual_create` | `POST /media/manual/create/` |
| `update_entry` | `PATCH /media/<type>/<instance_id>/` |
| `update_progress` | `POST /media/<type>/<instance_id>/progress/` |
| `update_score` | `POST /media/<type>/<instance_id>/score/` |
| `delete_entry` | `DELETE /media/<type>/<instance_id>/delete/` |
| `sync_metadata` | `POST /sync/<source>/<type>/<id>/` |
| `create_episode` | `POST /episodes/` |
| `get_statistics` | `GET /statistics/` |
| `get_me` | `GET /auth/me/` |

Enum values: `media_type` ∈ {`tv`, `movie`, `anime`, `manga`, `game`, `book`,
`comic`, `boardgame`, `season`}, `status` ∈ {`Completed`, `In progress`,
`Planning`, `Paused`, `Dropped`}, `source` ∈ {`tmdb`, `mal`, `igdb`,
`openlibrary`, `mangaupdates`, `comicvine`, `custom`}.

## Client configuration

If you installed globally (method 1), use `"command": "yamtrack-mcp"`.
If you prefer npx (no install), use `"command": "npx"` with
`"args": ["github:URD0TH/yamtrack-mcp"]`.

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "yamtrack": {
      "command": "yamtrack-mcp",
      "env": { "YAMTRACK_API_KEY": "<token>" }
    }
  }
}
```

### OpenCode (`opencode.json`)

```json
{
  "mcp": {
    "servers": {
      "yamtrack": {
        "type": "stdio",
        "command": "yamtrack-mcp",
        "env": { "YAMTRACK_API_KEY": "<token>" }
      }
    }
  }
}
```

### VS Code (`.vscode/mcp.json`) / Hermes (`~/.hermes/config.yaml`)

Same `command` shape; pass the token via the `YAMTRACK_API_KEY` env var.

### HTTP transport (any client that supports `url` + `headers`)

Start the server:

```bash
yamtrack-mcp --transport http --port 8080
```

Then configure the client:

```json
{
  "mcpServers": {
    "yamtrack": {
      "url": "http://localhost:8080/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

See the [wiki MCP](https://github.com/URD0TH/Yamtrack/wiki/MCP) for detailed
configuration examples for each client.

## Development

```bash
npm run verify   # typecheck (tsc) + lint/format (biome) + tests (vitest)
npm run typecheck
npm run lint     # biome check .
npm run format   # biome format --write .
npm run test     # vitest run
npm run dev      # build + run
```

Integration tests (`tests/server.test.ts`, `tests/http.test.ts`) drive every tool
against an in-process mock REST API over `InMemoryTransport` and HTTP, covering
auth (static token, per-request Bearer header, fallback token) and
request/response shapes.

## Resilience

For stdio, the MCP client respawns the process on exit. For HTTP, use the
`serve` subcommand which runs under PM2 with auto-restart and log management
(no separate PM2 install needed).

Alternatively, run `yamtrack-mcp --transport http` with your own supervisor
(systemd, Docker `restart:`, etc.). A `supervise.sh` helper is also available
in the repo.

## Project structure

```
yamtrack-mcp/
├── src/
│   ├── index.ts     # Entry: transport selection (stdio/http), CLI args
│   ├── client.ts    # YamtrackClient: REST wrapper, Bearer auth
│   └── tools.ts     # Tool definitions mapped to REST endpoints (zod schemas)
├── tests/           # Integration tests with a mock REST API
├── biome.json       # Lint + format config
├── tsconfig*.json   # TypeScript (build + typecheck)
└── vitest.config.ts
```

## FAQ

### `npm install -g github:URD0TH/yamtrack-mcp` does not work

This command creates a symlink in the global node\_modules pointing to a
temporary npm directory that gets deleted after installation, leaving a
broken binary. This is a known issue with `npm install -g` and git
dependencies.

Use the release tarball (method 1) or GitHub Packages (method 2) instead.

## License

Part of the [Yamtrack project](https://github.com/URD0TH/Yamtrack). See the main repository license.
