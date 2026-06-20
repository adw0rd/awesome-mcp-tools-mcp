# Dockerfile for awesome-mcp-bridge — a stdio <-> Streamable-HTTP MCP proxy.
#
# Used by Glama (https://glama.ai/mcp/servers) for introspection: Glama builds
# this image, starts the bridge over stdio, and sends `initialize` + `tools/list`.
# The bridge forwards those to the hosted endpoint (AWESOME_MCP_URL), so Glama
# sees the live tool list and can score the server.
#
# The bridge has zero runtime dependencies (native fetch, node:readline), so
# there is no install step — just copy the entrypoint and run it.

FROM node:20-alpine

# Catalog endpoint the bridge proxies to. Override at runtime to point the
# bridge at a self-hosted awesome-mcp.tools instance.
ENV AWESOME_MCP_URL=https://awesome-mcp.tools/mcp

WORKDIR /app

# Only the bridge is needed; it imports nothing else from the package.
COPY package.json ./
COPY bin/awesome-mcp-bridge.js ./bin/

# stdio MCP server: reads JSON-RPC on stdin, writes responses on stdout.
ENTRYPOINT ["node", "bin/awesome-mcp-bridge.js"]
