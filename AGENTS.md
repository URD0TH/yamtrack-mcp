# mcp — AGENTS.md

## Purpose

Standalone TypeScript MCP server (stdio transport) that exposes the Yamtrack
REST API as LLM tools. Runs independently of the Django app against any Yamtrack
instance over HTTP.

## Ownership

- Owner: integrations/mcp. Depends only on the public REST API (`wiki/API.md`).
- Tracked as a git submodule (`mcp/`) of the standalone repo
  `https://github.com/URD0TH/yamtrack-mcp.git`. Commit and push changes in that
  repo, then bump the submodule pointer in the parent Yamtrack repo.

## Local Contracts

- Entry: `src/index.ts` (`McpServer` + transport selection). Logs to stderr only.
- `src/client.ts`: `YamtrackClient` — REST wrapper, Bearer auth with the static API key.
- `src/tools.ts`: tool definitions mapped 1:1 to REST endpoints (zod schemas).
  Each tool handler applies an LLM-response transformer before returning data,
  stripping provider-specific noise (images, charts, color fields, API tokens)
  so the model sees only actionable fields:
  - `summarizeSearchResults`: extracts title, media_type, source, and IDs.
  - `summarizeDetails`: strips images, genres boilerplate, credits, charts.
  - `summarizeMediaEntry` / `summarizeMediaList`: flattens nested entry/list shapes.
  - `summarizeStatistics`: keeps media_count, consumption_stats (without color),
    score_average, status_summary; strips activity_data, distributions, and charts.
  - `get_home` transformer: strips nested section headers by iterating
    `in_progress.season.items`, `in_progress.movie.items`, etc. two levels deep.
  - `get_me`: strips the user's API token from the response.
- Auth: a single static API key via `YAMTRACK_API_KEY`/`--token` (no JWT login or refresh).
- Transports: `stdio` (default) uses the startup token; `http` (`--transport http`,
  StreamableHTTP stateless on `POST /mcp`) authenticates per connection from the
  `Authorization: Bearer <key>` header, falling back to the startup token when
  the header is absent. Both forward the key as `Bearer` to the REST API.
- Base URL: `YAMTRACK_BASE_URL` / `--base-url`, default `http://localhost:8000/api`.

## Work Guidance

- Add/change a tool when `wiki/API.md` endpoints, filters, or enums change.
- Keep tool names and enums in sync with the API wiki.
- Run `npm run build` before publishing; never commit `node_modules/` or `dist/`.
- Commit in the `yamtrack-mcp` repo first; update `README.md` there for user-facing
  changes and `wiki/MCP.md` in the parent (the single MCP server docs).

## Verification

- `npm run verify` runs typecheck (`tsc`), lint+format (`biome check`), and tests (`vitest run`).
- `npm run build` compiles `src/` to `dist/` under `strict`.
- Integration tests (`tests/server.test.ts`) drive every tool against an in-process
  mock REST API over `InMemoryTransport`, covering auth (static key), request/response
  shapes, and all transformer output forms. 22 tests total: 13 original tool tests,
  7 transformer tests, 2 HTTP transport tests.
- Smoke test: `node dist/index.js --help` and an MCP `initialize` + `tools/list`.

## Child DOX Index

- None (leaf module).
