# @nexus/mcp-adapters

The single responsibility of this package is to expose capability-based,
swappable MCP provider integrations behind one shared interface.

Internal agents request capabilities such as `weather` or `places`; they never
depend on a named MCP server directly.
