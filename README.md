# awesome-mcp

CLI and MCP stdio bridge for the [awesome-mcp.tools](https://awesome-mcp.tools) catalog of 2,000+ MCP (Model Context Protocol) servers. Search the catalog from your terminal, or wire the hosted MCP server into Claude / Cursor / Codex / Cline / Windsurf.

[![npm](https://img.shields.io/npm/v/awesome-mcp.svg)](https://www.npmjs.com/package/awesome-mcp)
[![license](https://img.shields.io/npm/l/awesome-mcp.svg)](./LICENSE)

```bash
# Install
npm install -g awesome-mcp        # or use npx (no install)

# Search the catalog
awesome-mcp search postgres
awesome-mcp top --language Python --limit 10
awesome-mcp trending
awesome-mcp info microsoft-playwright-mcp

# Run as an MCP stdio server (for Claude Desktop & other stdio-only clients)
awesome-mcp-bridge
```

## What this is

Two things in one npm package:

1. **`awesome-mcp` CLI** — search 2,000+ MCP servers from the terminal. Pure node 18+, zero dependencies.
2. **`awesome-mcp-bridge`** — minimal stdio↔Streamable-HTTP MCP proxy. Lets stdio-only clients connect to the hosted MCP server at `https://awesome-mcp.tools/mcp`. ~100 lines, zero deps.

Both wrap the same backend at [awesome-mcp.tools](https://awesome-mcp.tools). The catalog is refreshed every 6 hours from the open-source ecosystem.

## CLI usage

```
awesome-mcp search <query> [options]
awesome-mcp top [options]
awesome-mcp trending [options]
awesome-mcp hot [options]
awesome-mcp info <name> [--json]
awesome-mcp help

Filters: --source --category --tag --language --license
Options: --limit (1-100, default 20) --api <url> --json
```

Examples:

```bash
awesome-mcp search browser --source github --limit 20
awesome-mcp top --language Python
awesome-mcp trending --category "AI Tools"
awesome-mcp info markitdown
```

## MCP bridge usage

The bridge lets stdio-only MCP clients (Claude Desktop, older Cline) talk to the hosted Streamable-HTTP server. It reads JSON-RPC from stdin, forwards to `https://awesome-mcp.tools/mcp`, streams the response back. Session ID is auto-managed.

### Claude Desktop

Paste into `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "awesome-mcp-tools": {
      "command": "npx",
      "args": ["-y", "-p", "awesome-mcp", "awesome-mcp-bridge"]
    }
  }
}
```

Or use Claude Desktop **Settings → Connectors → Add custom connector** with URL `https://awesome-mcp.tools/mcp` (newer versions only).

### Cursor

`~/.cursor/mcp.json` — Cursor supports remote URLs natively, no bridge needed:

```json
{
  "mcpServers": {
    "awesome-mcp-tools": {
      "url": "https://awesome-mcp.tools/mcp"
    }
  }
}
```

### Codex CLI

Append to `~/.codex/config.toml`:

```toml
[mcp_servers.awesome-mcp-tools]
url = "https://awesome-mcp.tools/mcp"
```

### Cline

Cline VS Code panel → `cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "awesome-mcp-tools": {
      "type": "streamableHttp",
      "url": "https://awesome-mcp.tools/mcp",
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "awesome-mcp-tools": {
      "serverUrl": "https://awesome-mcp.tools/mcp"
    }
  }
}
```

Ready-to-paste copies in [`examples/`](./examples/).

## Tools exposed by the MCP server

| Tool | Description |
|---|---|
| `search_servers` | Full-text search with filters (category, language, tag, license, source) |
| `get_server` | Full details + README for one server by slug |
| `compare_servers` | Side-by-side comparison of two servers |
| `list_categories` | All categories with server counts |
| `list_languages` | Programming languages with counts |
| `list_tags` | Tags with counts |
| `list_trending` | Top servers by 24-hour star growth |
| `list_hot` | Featured / hot servers |

Full input/output schemas live at the live `tools/list` endpoint — see [`tools.json`](./tools.json) for an offline snapshot, or [server card](https://awesome-mcp.tools/.well-known/mcp/server-card.json) for transport metadata.

## Smoke test

Verify the hosted endpoint without installing anything:

```bash
npx @modelcontextprotocol/inspector --transport http https://awesome-mcp.tools/mcp
```

Or via raw curl:

```bash
curl -fsS -X POST https://awesome-mcp.tools/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json,text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}'
```

## Endpoint

```
https://awesome-mcp.tools/mcp
```

- Transport: **Streamable HTTP** (MCP spec `2025-06-18`)
- Auth: none (free, no API key)
- Server card: [/.well-known/mcp/server-card.json](https://awesome-mcp.tools/.well-known/mcp/server-card.json)
- Underlying REST API: [/api/docs](https://awesome-mcp.tools/api/docs) ([OpenAPI 3.0](https://awesome-mcp.tools/api/openapi.json))

Override the bridge target with `AWESOME_MCP_URL=https://your-mirror/mcp awesome-mcp-bridge` (useful for self-hosting or testing).

## What's *not* in this repo

The hosted server backend (Go API, ingestion crawlers, SSR, OG image generation) is a separate proprietary codebase. This repo contains only:

- The `awesome-mcp` CLI source
- The `awesome-mcp-bridge` stdio→HTTP proxy source
- Client config examples
- Snapshot of the live `tools/list` response for offline reference

The catalog *data* served by the backend is open: each server entry preserves its upstream license. The backend code is not.

## Tests

```bash
npm test
```

`npm test` runs the CLI lib tests (6 passing under node 18+). The bridge currently has only a manual smoke test against production (pipe a JSON-RPC `initialize` into `bin/awesome-mcp-bridge.js`); mock-based unit tests are on the roadmap for v0.2.1.

## Status

Production-ready. `awesome-mcp.tools` is live, monitored, refreshed every 6 hours. Issues: [github.com/adw0rd/awesome-mcp-tools-mcp/issues](https://github.com/adw0rd/awesome-mcp-tools-mcp/issues).

## License

[MIT](./LICENSE).
