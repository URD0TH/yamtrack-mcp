# Usage

## Transports: stdio vs http

- **stdio** (default): the client launches `yamtrack-mcp` as a subprocess
  and talks over stdin/stdout. Pass the token via `--token` /
  `YAMTRACK_API_KEY` and the instance via `--base-url` / `YAMTRACK_BASE_URL`.
  Use this for local, single-client setups (Claude Desktop, Codex, OpenCode,
  VS Code, Hermes, Antigravity, Pi).
- **http** (`--transport http`): the server listens on `POST /mcp`
  (StreamableHTTP, stateless) and authenticates each connection from the
  `Authorization: Bearer <key>` header it receives, falling back to
  `--token` / `YAMTRACK_API_KEY` when the header is absent. Use this for remote
  instances or multiple clients sharing one server.

> **Remote host?** Always use HTTP transport. The client connects to
> `http://<host>:<port>/mcp` with `headers: { "Authorization": "Bearer <token>" }`.
> The server runs on the remote host with `yamtrack-mcp --transport http --port <n>`.

## Two ports, two endpoints — do not swap them

The MCP server sits **between** your assistant and Yamtrack, so it binds **two**
different addresses that are easy to confuse:

| Flag | Endpoint | What it is | Who connects there |
|------|----------|------------|--------------------|
| `--port <n>` | `http://<host>:<n>/mcp` | The **MCP server** itself (this program) | Your assistant (Claude, Hermes, etc.) |
| `--base-url <url>` | `http://<host>:<api-port>/api` | The **Yamtrack REST API** (Django) | The MCP server (as an HTTP client) |

- `--port` / `/mcp` is where the **assistant** connects. Pick any free port
  (e.g. `9123`).
- `--base-url` / `/api` is where **Yamtrack** runs — the API port of your
  Yamtrack instance (e.g. `8000`, the port the Yamtrack container publishes),
  **not** the MCP port. Defaults to `http://localhost:8000/api`.

Example — Yamtrack on `8000`, MCP server on `9123`:

```bash
yamtrack-mcp --transport http --port 9123 --base-url http://yamtrack.local:8000/api
```

The `/mcp` endpoint is provided **only** by this standalone server; Yamtrack
itself has no `/mcp` route.

## Workflows

These are the canned flows the skill enables. Tool names are exact; see
`tools.md` for parameters and enums.

### Research & Track

1. `search_media` with the user's query (and `media_type` when known).
2. If the item is **not** already tracked, `create_entry` (provider id +
   `source`) — or `manual_create` for a custom item — in **Planning** status.
3. Confirm to the user what was added.

### Update progress

- TV/anime: `create_episode` with `season_number`, `episode_number`, and
  `end_date` (re-send with `end_date` to correct the watch date).
- Generic bump: `update_progress` with `operation` `increase`/`decrease`.
- Rating: `update_score` (0–10).

### Batch statistics

- `get_statistics` across one or more date ranges (`start_date`/`end_date`,
  `"all"` for a full range) and compare.
- `get_home` for the in-progress/planning dashboard.
- `get_history` to explain why an item's fields changed.

## Example natural-language triggers

- "Track Dune (2021) in Yamtrack as a movie."
- "What am I currently watching?"
- "Mark episode 4 of season 2 of Breaking Bad as watched yesterday."
- "Give me my reading stats for 2025."
- "Set my score for Final Fantasy VII to 9."
- "Configure Yamtrack MCP in Codex." (→ see `clients.md`)
