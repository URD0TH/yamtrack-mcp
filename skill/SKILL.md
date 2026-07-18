---
name: yamtrack-mcp
description: |
  Use this skill whenever the user wants to track, search, update, or query
  media (movies, TV, anime, manga, games, books, comics, board games) in
  Yamtrack through an AI assistant, or to set up / configure the Yamtrack MCP
  server in any client (Claude, Codex, OpenCode, VS Code, Hermes, Google
  Antigravity, Pi, or over HTTP). Trigger on phrases like "track this show in
  Yamtrack", "add <title> to my list", "what am I watching", "mark episode N",
  "update my score", "configure Yamtrack MCP", "connect Yamtrack to Claude/",
  "Codex/OpenCode/Antigravity/Pi", even when the MCP server is not yet
  installed. Covers both using the MCP tools and installing/configuring the
  server.
---

# yamtrack-mcp

This skill describes how to use the [Yamtrack](https://github.com/FuzzyGrim/Yamtrack)
MCP server (`yamtrack-mcp`) — a standalone TypeScript server that exposes the
Yamtrack REST API as LLM tools. It runs on **any machine** against any reachable
Yamtrack instance over HTTP; it needs no Django, no Python, and no HTTP bridge.

This skill is **documentation + workflows only**. It does not add code to the
server. The authoritative data source is the server's own `README.md` and the
project wiki (`wiki/MCP.md`, `wiki/API.md`, `wiki/Skill.md`). When something
disagrees with those, trust the wiki and `README.md`.

## When to read each reference

- **Before installing or configuring a client** → `references/clients.md`
  (one section per client: Claude, Codex, OpenCode, VS Code, Hermes,
  Google Antigravity, Pi, and generic HTTP).
- **Before running the server / issuing auth** → `references/install.md`
  (build, run, API-key auth, `supervise.sh` resilience).
- **Choosing how to call a tool / what fields exist** → `references/tools.md`
  (all 15 tools mapped 1:1 to REST endpoints, plus the enums).
- **Deciding stdio vs http, or running a workflow** → `references/usage.md`
  (transport choice, the two-ports gotcha, and the canned workflows).

## Mental model

The MCP server sits **between** the assistant and Yamtrack. The assistant talks
MCP to the server; the server forwards `Authorization: Bearer <key>` to the
Yamtrack REST API. Read-only tools (`search_media`, `get_details`) work with no
token. Everything else requires the static account API key (from **Account
settings → Integrations**). One key works for the MCP server, the REST API, and
integration webhooks (Plex/Jellyfin/Emby).

## Core workflows

1. **Research & Track** — `search_media` for a query; if not already tracked,
   `create_entry` (or `manual_create` for a custom item) in **Planning** status.
2. **Update progress** — `update_progress` (increase/decrease) or
   `create_episode` for TV/anime seasons; reflect the watch date with
   `end_date`.
3. **Batch statistics** — `get_statistics` across one or more date ranges and
   compare; `get_home` for the in-progress/planning dashboard.

Keep tool names and enum values exactly as listed in `references/tools.md` — the
server validates against them.

## Reference links

- Server README: `mcp/README.md` (in this repo)
- Wiki MCP docs: https://github.com/FuzzyGrim/Yamtrack/wiki/MCP
- Wiki API docs: https://github.com/FuzzyGrim/Yamtrack/wiki/API
- Wiki skill docs: https://github.com/FuzzyGrim/Yamtrack/wiki/Skill
