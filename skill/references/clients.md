# Client Configuration

The server speaks **stdio** by default, so most clients just need a
`command` block pointing at the installed binary, plus the token via
`YAMTRACK_API_KEY` and the instance URL via `YAMTRACK_BASE_URL` (default
`http://localhost:8000/api`). For remote/HTTP clients use the `url` + `headers`
form (see the last section).

If you installed globally (`npm install -g github:URD0TH/yamtrack-mcp`), use
`"command": "yamtrack-mcp"`. If you prefer npx, use `"command": "npx"` with
`"args": ["github:URD0TH/yamtrack-mcp"]`.

Replace `<your-token>` with your static API key from **Account settings →
Integrations**.

## Claude Desktop

File: `claude_desktop_config.json` (macOS
`~/Library/Application Support/Claude/`, Windows
`%APPDATA%\Claude\`).

```json
{
  "mcpServers": {
    "yamtrack": {
      "command": "yamtrack-mcp",
      "env": {
        "YAMTRACK_API_KEY": "<your-token>",
        "YAMTRACK_BASE_URL": "https://your-yamtrack-instance.com/api"
      }
    }
  }
}
```

## Codex CLI

File: `~/.codex/config.toml` (or `$CODEX_HOME/config.toml`). Codex uses TOML
tables, not JSON. Historically Codex runs **local stdio** servers only (no
remote HTTP), so use the stdio form below.

```toml
[mcp_servers.yamtrack]
command = "yamtrack-mcp"
env = { YAMTRACK_API_KEY = "<your-token>", YAMTRACK_BASE_URL = "https://your-yamtrack-instance.com/api" }
```

Equivalent CLI (persists to the same `config.toml`):

```bash
codex mcp add yamtrack -- yamtrack-mcp
```

Then export the env vars in your shell, or add them to the TOML `env` block as
shown above.

## OpenCode

File: `opencode.json` (project root or `~/.config/opencode/opencode.json`),
under `mcp.servers`.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "yamtrack": {
        "type": "stdio",
        "command": "yamtrack-mcp",
        "enabled": true,
        "env": {
          "YAMTRACK_API_KEY": "<your-token>",
          "YAMTRACK_BASE_URL": "https://your-yamtrack-instance.com/api"
        }
      }
    }
  }
}
```

## VS Code

File: `.vscode/mcp.json` (workspace) or your user profile. Same `command`/`args`
shape; pass the token via `YAMTRACK_API_KEY`.

```json
{
  "servers": {
    "yamtrack": {
      "type": "stdio",
      "command": "yamtrack-mcp",
      "env": {
        "YAMTRACK_API_KEY": "<your-token>",
        "YAMTRACK_BASE_URL": "https://your-yamtrack-instance.com/api"
      }
    }
  }
}
```

## Hermes

File: `~/.hermes/config.yaml`, under `mcp_servers`. Same `command`/`args` shape;
pass the token via `YAMTRACK_API_KEY`.

## Google Antigravity

Antigravity (IDE and CLI) reads MCP config as JSON with the `mcpServers` key.

- **Global:** `~/.gemini/config/mcp_config.json`
- **Workspace:** `.agents/mcp_config.json` (in your project root)

```json
{
  "mcpServers": {
    "yamtrack": {
      "command": "yamtrack-mcp",
      "env": {
        "YAMTRACK_API_KEY": "<your-token>",
        "YAMTRACK_BASE_URL": "https://your-yamtrack-instance.com/api"
      }
    }
  }
}
```

Alternatively, open the Agent panel → **...** → **MCP Servers → Manage MCP
Servers → View raw config**, or use the built-in MCP Store (`/mcp` in the CLI).

## Pi

Pi reads MCP config as JSON with the `mcpServers` key.

- **Global:** `~/.pi/agent/mcp.json`
- **Project:** `.pi/mcp.json` (project root; overrides global)

```json
{
  "mcpServers": {
    "yamtrack": {
      "command": "yamtrack-mcp",
      "env": {
        "YAMTRACK_API_KEY": "<your-token>",
        "YAMTRACK_BASE_URL": "https://your-yamtrack-instance.com/api"
      }
    }
  }
}
```

## HTTP transport (any client that supports `url` + `headers`)

Run the server with either:

  yamtrack-mcp --transport http     # foreground, terminal-bound
  yamtrack-mcp serve --port 8080    # daemonized under PM2 (see install.md)

It listens on `POST /mcp` (StreamableHTTP, stateless) and authenticates each
connection via the `Authorization: Bearer <key>` header. This works for any
client that connects to a remote MCP URL (e.g. Claude Code, OpenCode
`type: "http"`, VS Code, Antigravity, Pi, Cursor).

```json
{
  "mcpServers": {
    "yamtrack": {
      "url": "http://localhost:8080/mcp",
      "headers": { "Authorization": "Bearer <your-token>" }
    }
  }
}
```

For OpenCode over HTTP, set `"type": "http"` instead of `"type": "stdio"` and use
the `url` form above.

> For HTTP, the assistant connects to the MCP server's port (`--port`/`/mcp`).
> The server itself connects to Yamtrack's REST API port (`--base-url`/`/api`).
> These are two different addresses — see `references/usage.md`.
