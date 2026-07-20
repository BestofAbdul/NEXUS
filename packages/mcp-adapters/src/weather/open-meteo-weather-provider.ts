import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { MCPProvider, MCPRequest, MCPResponse } from "../index";

const weatherObservationShape = {
  source: z.literal("Open-Meteo"),
  location: z.string(),
  country: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  observedAt: z.string(),
  temperatureC: z.number(),
  apparentTemperatureC: z.number(),
  windSpeedKph: z.number(),
  weatherCode: z.number(),
  conditions: z.string(),
};

const weatherObservationSchema = z.object(weatherObservationShape);

const geocodingResponseSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        country: z.string().default("Unknown"),
        latitude: z.number(),
        longitude: z.number(),
      }),
    )
    .optional(),
});

const forecastResponseSchema = z.object({
  timezone: z.string(),
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    weather_code: z.number(),
    wind_speed_10m: z.number(),
  }),
});

export type WeatherObservation = z.infer<typeof weatherObservationSchema>;

export class OpenMeteoWeatherProvider implements MCPProvider {
  readonly id = "open-meteo-weather";
  readonly capabilities = ["weather"] as const;

  async invoke(request: MCPRequest): Promise<MCPResponse<WeatherObservation>> {
    if (request.capability !== "weather" || request.operation !== "current") {
      return {
        ok: false,
        error: `Unsupported weather request: ${request.capability}/${request.operation}`,
      };
    }

    const location = request.input.location;
    if (typeof location !== "string" || location.trim().length === 0) {
      return { ok: false, error: "Weather requests require a location." };
    }

    const server = createWeatherServer();
    const client = new Client({
      name: "nexus-weather-client",
      version: "1.0.0",
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      const result = await client.callTool({
        name: "get_current_weather",
        arguments: { location: location.trim() },
      });

      if ("toolResult" in result) {
        return { ok: false, error: "Weather MCP returned an unexpected task." };
      }

      if (result.isError || !result.structuredContent) {
        return {
          ok: false,
          error: readToolError(result.content) ?? "Weather MCP tool failed.",
        };
      }

      const observation = weatherObservationSchema.parse(
        result.structuredContent,
      );
      const serverVersion = client.getServerVersion();

      return {
        ok: true,
        data: observation,
        metadata: {
          protocol: "MCP",
          transport: "in-memory",
          serverName: serverVersion?.name,
          serverVersion: serverVersion?.version,
          tool: "get_current_weather",
        },
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown weather MCP provider failure.",
      };
    } finally {
      await Promise.allSettled([client.close(), server.close()]);
    }
  }
}

function createWeatherServer(): McpServer {
  const server = new McpServer({
    name: "nexus-open-meteo-weather",
    version: "1.0.0",
  });

  server.registerTool(
    "get_current_weather",
    {
      description:
        "Resolve a place name and return live current weather from Open-Meteo.",
      inputSchema: {
        location: z.string().min(1).describe("City or destination name"),
      },
      outputSchema: weatherObservationShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ location }) => {
      const observation = await fetchCurrentWeather(location);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(observation),
          },
        ],
        structuredContent: observation,
      };
    },
  );

  return server;
}

async function fetchCurrentWeather(
  location: string,
): Promise<WeatherObservation> {
  const geocodingUrl = new URL(
    "https://geocoding-api.open-meteo.com/v1/search",
  );
  geocodingUrl.searchParams.set("name", location);
  geocodingUrl.searchParams.set("count", "1");
  geocodingUrl.searchParams.set("language", "en");
  geocodingUrl.searchParams.set("format", "json");

  const geocoding = geocodingResponseSchema.parse(
    await fetchJsonWithRetry(geocodingUrl),
  );
  const place = geocoding.results?.[0];
  if (!place) {
    throw new Error(`Open-Meteo could not resolve location: ${location}`);
  }

  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.searchParams.set("latitude", String(place.latitude));
  forecastUrl.searchParams.set("longitude", String(place.longitude));
  forecastUrl.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
  );
  forecastUrl.searchParams.set("timezone", "auto");

  const forecast = forecastResponseSchema.parse(
    await fetchJsonWithRetry(forecastUrl),
  );

  return {
    source: "Open-Meteo",
    location: place.name,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: forecast.timezone,
    observedAt: forecast.current.time,
    temperatureC: forecast.current.temperature_2m,
    apparentTemperatureC: forecast.current.apparent_temperature,
    windSpeedKph: forecast.current.wind_speed_10m,
    weatherCode: forecast.current.weather_code,
    conditions: weatherCodeToConditions(forecast.current.weather_code),
  };
}

async function fetchJsonWithRetry(url: URL): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "NEXUS/1.0 weather MCP provider" },
        signal: AbortSignal.timeout(12_000),
      });

      if (!response.ok) {
        throw new Error(
          `Open-Meteo request failed with HTTP ${response.status}.`,
        );
      }

      return response.json();
    } catch (error) {
      lastError = error;

      if (attempt < 3) {
        await delay(500 * 2 ** attempt);
      }
    }
  }

  const detail =
    lastError instanceof Error
      ? `${lastError.message}${formatErrorCause(lastError.cause)}`
      : "unknown network error";

  throw new Error(
    `Open-Meteo request to ${url.hostname} failed after 4 attempts: ${detail}`,
  );
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function formatErrorCause(cause: unknown): string {
  if (cause instanceof Error) {
    return ` (${cause.message})`;
  }

  return "";
}

function readToolError(
  content: Array<{ type: string; text?: string }>,
): string | undefined {
  return content.find((item) => item.type === "text")?.text;
}

function weatherCodeToConditions(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Unknown conditions";
}
