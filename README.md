# yamtrack-mcp

A standalone [Model Context Protocol](https://modelcontextprotocol.org) server
(**stdio** or **http** transport, TypeScript) that exposes the [Yamtrack](https://github.com/FuzzyGrim/Yamtrack)
REST API as tools for LLMs (Claude Desktop, OpenCode, VS Code, Hermes, etc.).

It runs on **any machine** and talks to a Yamtrack instance over its public
REST API. No Django code required.

## Requirements

- Node.js 18+ (developed on v22/v26)
- A reachable Yamtrack instance (e.g. `http://localhost:8000` or your hosted URL)
- An API token **or** a username/password for that instance

## Install & build

```bash
npm install        # install dependencies
npm run build      # compile src/ -> dist/ (strict TypeScript)
```

## Run

```bash
node dist/index.js --help
```

## Authentication

The server authenticates to Yamtrack with a Bearer token. Precedence:

1. `--token <token>` / env `YAMTRACK_API_KEY` — a **static account API key**
   (recommended, never expires) or a JWT.
2. `--username` + `--password` — mints a JWT at startup and **auto-refreshes**
   it on 401 (JWTs expire after 1h).

| Option | Env var | Description |
|--------|---------|-------------|
| `--transport <type>` | – | `stdio` (default) or `http` |
| `--base-url <url>` | `YAMTRACK_BASE_URL` | API base URL. Default `http://localhost:8000/api` |
| `--token <token>` | `YAMTRACK_API_KEY` | Static API key (http fallback when no header) |
| `--port <n>` | – | Port for `http` transport. Default `8080` |
| `--username <user>` | – | Username (mint JWT at startup) |
| `--password <pass>` | – | Password (mint JWT at startup) |
| `--help` | – | Show usage |

Read-only tools (`search_media`, `get_details`) work **without** authentication.

### HTTP transport

With `--transport http` the server listens on `POST /mcp` (StreamableHTTP,
stateless). Each connection authenticates via the `Authorization: Bearer
<token>` header it receives, falling back to `--token` / `YAMTRACK_API_KEY`
when the header is absent. The token is then forwarded as a Bearer token to
the Yamtrack REST API, exactly like the stdio transport.

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

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "yamtrack": {
      "command": "node",
      "args": ["/abs/path/to/yamtrack-mcp/dist/index.js"],
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
        "command": "node",
        "args": ["/abs/path/to/yamtrack-mcp/dist/index.js"],
        "env": { "YAMTRACK_API_KEY": "<token>" }
      }
    }
  }
}
```

### VS Code (`.vscode/mcp.json`) / Hermes (`~/.hermes/config.yaml`)

Same `command`/`args` shape; pass the token via the `YAMTRACK_API_KEY` env var.

### HTTP transport (any client that supports `url` + `headers`)

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

Run the server with `node dist/index.js --transport http` (optionally
`--port <n>`). This mirrors how other HTTP MCP servers (e.g. Simkl) are
configured.

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

`supervise.sh` wraps the server and restarts it if it crashes, up to
`YAMTRACK_MCP_MAX_RETRIES` attempts (default `5`, with a
`YAMTRACK_MCP_RETRY_INTERVAL` seconds delay, default `2`). Each attempt and the
final give-up are logged to stderr. After the limit is reached the supervisor
exits. The server's own clean exit (code `0`) is not retried.

```bash
./supervise.sh --transport http --port 9123 --base-url http://10.0.0.5:8000/api
```

## Project structure

```
yamtrack-mcp/
├── src/
│   ├── index.ts     # Entry: transport selection (stdio/http), CLI args
│   ├── client.ts    # YamtrackClient: REST wrapper, Bearer auth, JWT refresh
│   └── tools.ts     # Tool definitions mapped to REST endpoints (zod schemas)
├── tests/           # Integration tests with a mock REST API
├── biome.json       # Lint + format config
├── tsconfig*.json   # TypeScript (build + typecheck)
└── vitest.config.ts
```

## License

Part of the Yamtrack project. See the main repository license.
