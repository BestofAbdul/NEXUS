export interface MCPRequest {
  capability: string;
  operation: string;
  input: Record<string, unknown>;
}

export interface MCPResponse<TData = unknown> {
  ok: boolean;
  data?: TData;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface MCPProvider {
  readonly id: string;
  readonly capabilities: readonly string[];
  invoke(request: MCPRequest): Promise<MCPResponse>;
}

export * from "./provider-registry";
export * from "./knowledge/wikimedia-knowledge-provider";
export * from "./places/openstreetmap-places-provider";
export * from "./weather/open-meteo-weather-provider";
export * from "./flights/amadeus-flight-provider";
export * from "./search/tavily-evidence-provider";
export * from "./currency/frankfurter-currency-provider";
export * from "./countries/rest-countries-provider";
