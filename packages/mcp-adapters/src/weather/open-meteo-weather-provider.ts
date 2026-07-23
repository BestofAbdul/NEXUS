import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { MCPProvider, MCPRequest, MCPResponse } from "../index";

const weatherForecastShape = {
  source: z.literal("Open-Meteo"),
  location: z.string(),
  country: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  timezone: z.string(),
  requestedDate: z.string(),
  status: z.enum(["FORECAST", "OUT_OF_RANGE"]),
  forecastHorizonDays: z.number(),
  forecast: z
    .object({
      temperatureMaxC: z.number(),
      temperatureMinC: z.number(),
      precipitationProbabilityPercent: z.number(),
      windSpeedMaxKph: z.number(),
      weatherCode: z.number(),
      conditions: z.string(),
    })
    .nullable(),
  note: z.string().nullable(),
};

const weatherForecastSchema = z.object(weatherForecastShape);

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
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_probability_max: z.array(z.number()),
    wind_speed_10m_max: z.array(z.number()),
    weather_code: z.array(z.number()),
  }),
});

export type WeatherForecast = z.infer<typeof weatherForecastSchema>;

const FORECAST_HORIZON_DAYS = 16;

export class OpenMeteoWeatherProvider implements MCPProvider {
  readonly id = "open-meteo-weather";
  readonly capabilities = ["weather"] as const;

  async invoke(request: MCPRequest): Promise<MCPResponse<WeatherForecast>> {
    if (request.capability !== "weather" || request.operation !== "forecast") {
      return {
        ok: false,
        error: `Unsupported weather request: ${request.capability}/${request.operation}`,
      };
    }

    const location = request.input.location;
    const date = request.input.date;
    if (
      typeof location !== "string" ||
      location.trim().length === 0 ||
      typeof date !== "string" ||
      !isIsoDate(date)
    ) {
      return {
        ok: false,
        error: "Weather forecasts require a location and YYYY-MM-DD date.",
      };
    }

    const server = createWeatherServer();
    const client = new Client({
      name: "nexus-weather-client",
      version: "2.0.0",
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const result = await client.callTool({
        name: "get_weather_forecast",
        arguments: { location: location.trim(), date },
      });

      if ("toolResult" in result || result.isError || !result.structuredContent) {
        return {
          ok: false,
          error: readToolError(result.content) ?? "Weather MCP tool failed.",
        };
      }

      const forecast = weatherForecastSchema.parse(result.structuredContent);
      const serverVersion = client.getServerVersion();
      return {
        ok: true,
        data: forecast,
        metadata: {
          protocol: "MCP",
          transport: "in-memory",
          serverName: serverVersion?.name,
          serverVersion: serverVersion?.version,
          tool: "get_weather_forecast",
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
    version: "2.0.0",
  });

  server.registerTool(
    "get_weather_forecast",
    {
      description:
        "Resolve a destination and return the Open-Meteo daily forecast for a selected travel date when it is inside the forecast horizon.",
      inputSchema: {
        location: z.string().min(1),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      },
      outputSchema: weatherForecastShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ location, date }) => {
      const forecast = await fetchWeatherForecast(location, date);
      return {
        content: [{ type: "text", text: JSON.stringify(forecast) }],
        structuredContent: forecast,
      };
    },
  );

  return server;
}

async function fetchWeatherForecast(
  location: string,
  requestedDate: string,
): Promise<WeatherForecast> {
  const daysAway = differenceInUtcDays(todayIso(), requestedDate);
  if (daysAway < 0 || daysAway >= FORECAST_HORIZON_DAYS) {
    return {
      source: "Open-Meteo",
      location,
      country: "Unknown",
      latitude: null,
      longitude: null,
      timezone: "unavailable",
      requestedDate,
      status: "OUT_OF_RANGE",
      forecastHorizonDays: FORECAST_HORIZON_DAYS,
      forecast: null,
      note:
        daysAway < 0
          ? "The selected travel date is in the past, so no forecast was requested."
          : `The selected date is outside Open-Meteo's ${FORECAST_HORIZON_DAYS}-day forecast horizon. NEXUS will not substitute current weather.`,
    };
  }

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
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weather_code",
  );
  forecastUrl.searchParams.set("start_date", requestedDate);
  forecastUrl.searchParams.set("end_date", requestedDate);
  forecastUrl.searchParams.set("timezone", "auto");

  const payload = forecastResponseSchema.parse(
    await fetchJsonWithRetry(forecastUrl),
  );
  const index = payload.daily.time.indexOf(requestedDate);
  if (index < 0) {
    throw new Error(`Open-Meteo returned no forecast for ${requestedDate}.`);
  }

  return {
    source: "Open-Meteo",
    location: place.name,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: payload.timezone,
    requestedDate,
    status: "FORECAST",
    forecastHorizonDays: FORECAST_HORIZON_DAYS,
    forecast: {
      temperatureMaxC: payload.daily.temperature_2m_max[index]!,
      temperatureMinC: payload.daily.temperature_2m_min[index]!,
      precipitationProbabilityPercent:
        payload.daily.precipitation_probability_max[index]!,
      windSpeedMaxKph: payload.daily.wind_speed_10m_max[index]!,
      weatherCode: payload.daily.weather_code[index]!,
      conditions: weatherCodeToConditions(payload.daily.weather_code[index]!),
    },
    note: null,
  };
}

async function fetchJsonWithRetry(url: URL): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "NEXUS/2.0 weather MCP provider" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) {
        throw new Error(`Open-Meteo request failed with HTTP ${response.status}.`);
      }
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Open-Meteo forecast request failed.");
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function differenceInUtcDays(from: string, to: string): number {
  return Math.floor(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

function isIsoDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

function readToolError(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;
  const item = content.find(
    (entry): entry is { type: string; text?: string } =>
      typeof entry === "object" &&
      entry !== null &&
      "type" in entry &&
      entry.type === "text",
  );
  return item?.text;
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
