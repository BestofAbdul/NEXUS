# @nexus/mcp-adapters

The single responsibility of this package is to expose capability-based,
swappable MCP provider integrations behind one shared interface.

Internal agents request capabilities such as `weather` or `places`; they never
depend on a named MCP server directly.

Registered providers use the official MCP TypeScript SDK:

- `AmadeusFlightProvider` is optional. When registered, it resolves route text
  to airport/city IATA codes and searches real flight schedules/fares and hotel
  offers. NEXUS does not register it unless both credentials exist.
- `OpenMeteoWeatherProvider` calls `get_weather_forecast` for the selected
  travel date. Dates outside the 16-day forecast horizon are labeled
  `OUT_OF_RANGE`; current weather is never substituted.
- `OpenStreetMapPlacesProvider` calls `find_nearby_places` to return named
  attractions, museums, viewpoints, and parks around a resolved Travel
  destination.
- `WikimediaKnowledgeProvider` calls `search_knowledge` with a query assembled
  from each non-Travel mission's goal and submitted setup answers.
- `FrankfurterCurrencyProvider` returns current exchange-rate evidence and uses
  REST Countries to resolve route-country currencies.
- `TavilyEvidenceProvider` is the default research provider for immigration,
  jobs, housing, healthcare, education, government guidance, relocation,
  events, medical travel, transportation, and freight. It stores Tavily's
  synthesized answer, source excerpts, URLs, and relevance-derived confidence.
