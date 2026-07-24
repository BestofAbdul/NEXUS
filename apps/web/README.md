# @nexus/web

The single responsibility of this package is to expose thin public transports
over the Mission Engine and provide the secondary operator control plane.

- `/api/mcp` exposes the `nexus_mission` tool through MCP Streamable HTTP.
- `/api/a2mcp/mission` remains a REST compatibility adapter.
- Mission Control includes a thin conversation composer and renders the durable
  USER/AGENT history returned by the shared A2MCP contract.

The callable agent service is the product. This package must not become a
standalone consumer web app or general chat interface, and transport routes must
not duplicate mission business logic.
