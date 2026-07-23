# @nexus/mcp-adapters

The single responsibility of this package is to expose capability-based,
swappable MCP provider integrations behind one shared interface.

Internal agents request capabilities such as `weather` or `places`; they never
depend on a named MCP server directly.

Registered providers use the official MCP TypeScript SDK:

- `AmadeusFlightProvider` resolves human route text to airport/city IATA codes,
  then searches real flight schedules/fares and hotel offers. It requires
  `AMADEUS_CLIENT_ID`/`AMADEUS_CLIENT_SECRET` and returns an explicit
  unconfigured state when they are absent.
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
- `TavilyEvidenceProvider` searches current source-preserving evidence for
  immigration, jobs, housing, healthcare, education, taxes, property, events,
  medical travel, and freight capabilities when `TAVILY_API_KEY` is configured.
