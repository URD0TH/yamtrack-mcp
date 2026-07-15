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

- Entry: `src/index.ts` (`McpServer` + `StdioServerTransport`). Logs to stderr only.
- `src/client.ts`: `YamtrackClient` — REST wrapper, Bearer auth with the static API key.
- `src/tools.ts`: tool definitions mapped 1:1 to REST endpoints (zod schemas).
- Auth: a single static API key via `YAMTRACK_API_KEY`/`--token` (no JWT login or refresh).
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
  mock REST API over `InMemoryTransport`, covering auth (static API key) and
  request/response shapes.
- Smoke test: `node dist/index.js --help` and an MCP `initialize` + `tools/list`.

## Child DOX Index

- None (leaf module).
