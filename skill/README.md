# Yamtrack MCP Skill

A packaged [Agent Skill](https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills/intro)
(`yamtrack-mcp`) that lets an AI assistant use the [Yamtrack](https://github.com/FuzzyGrim/Yamtrack)
[MCP server](https://github.com/URD0TH/yamtrack-mcp) — search, track, update, and
query your media (movies, TV, anime, manga, games, books, comics, board games)
through Claude, Codex, OpenCode, VS Code, Hermes, Google Antigravity, Pi, or any
HTTP-capable client.

This skill is **documentation + workflows only**. It does not add code to the
MCP server; all facts come from the server `README.md` and the project wiki
(`wiki/MCP.md`, `wiki/API.md`, `wiki/Skill.md`).

## What's inside

```
skill/
├── SKILL.md          # instructions + workflow index (the skill entrypoint)
├── README.md         # this file
├── references/
│   ├── tools.md      # 15 MCP tools mapped 1:1 to REST endpoints + enums
│   ├── install.md    # install (npx github / GitHub Packages), run, API-key auth
│   ├── clients.md    # setup for each client (Claude, Codex, OpenCode, VS Code,
│   │                 #   Hermes, Antigravity, Pi, generic HTTP)
│   └── usage.md      # stdio vs http, the two-ports gotcha, canned workflows
├── .claude-plugin/   # plugin manifest for curated marketplaces
├── LICENSE
└── CODEOWNERS
```

## Install the skill (manual)

Copy the `skill/` directory so its folder name matches the skill `name`
(`yamtrack-mcp`):

- **Project** (this repo only): `.opencode/skills/yamtrack-mcp/` or
  `.claude/skills/yamtrack-mcp/`
- **Global** (all projects): `~/.config/opencode/skills/yamtrack-mcp/` or
  `~/.claude/skills/yamtrack-mcp/`

Agents that scan the filesystem (Claude Code, Codex, OpenCode, Cursor,
Antigravity, Pi, etc.) discover `SKILL.md` automatically on startup.

## Install the MCP server (one time)

The skill assumes the MCP server is already built and reachable. To build it:

```bash
git clone https://github.com/URD0TH/yamtrack-mcp
cd yamtrack-mcp
npm install
npm run build
node dist/index.js --help
```

Get your static API key from **Account settings → Integrations** in your
Yamtrack instance. Then configure your client — see `references/clients.md`.

## Publish

- **Aggregators** (SkillsMP, Skills.sh/Vercel, Agensi): index repos from
  GitHub; only a valid `SKILL.md` is required. This skill qualifies.
- **Curated plugin marketplaces** (e.g. claude-market): use the
  `.claude-plugin/plugin.json` manifest in this folder. It declares the skill
  for `make generate-marketplace-json` / PR-based submission.

## License

Part of the Yamtrack project. See `LICENSE`.
