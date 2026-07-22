# @nexus/mcp-adapters

The single responsibility of this package is to expose capability-based,
swappable MCP provider integrations behind one shared interface.

Internal agents request capabilities such as `weather` or `places`; they never
depend on a named MCP server directly.

Registered providers use the official MCP TypeScript SDK:

- `OpenMeteoWeatherProvider` calls `get_current_weather` for live destination
  conditions and coordinates.
- `OpenStreetMapPlacesProvider` calls `find_nearby_places` to return named
  attractions, museums, viewpoints, and parks around a resolved Travel
  destination.
- `WikimediaKnowledgeProvider` calls `search_knowledge` with a query assembled
  from each non-Travel mission's goal and submitted setup answers.
