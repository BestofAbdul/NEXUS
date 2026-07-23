import type { MissionResearchResult } from "@nexus/shared";
import {
  MCPProviderRegistry,
  type AirportRoute,
  type CurrencyEvidence,
  type EvidenceSearch,
  type FlightOfferSearch,
  type HotelOfferSearch,
  type KnowledgeSearch,
  type NearbyPlaces,
  type WeatherForecast,
} from "@nexus/mcp-adapters";
import type { Agent, AgentInput, AgentResult } from "./index";

export interface ResearchData {
  providerId: string;
  capability: string;
  summary: string;
  data: Record<string, unknown>;
  sourceUrls: string[];
  retrievedAt: Date;
}

export class ResearchAgent implements Agent<ResearchData> {
  readonly id = "research-agent";
  readonly capabilities = ["external-research"] as const;

  constructor(private readonly providers: MCPProviderRegistry) {}

  async run(input: AgentInput): Promise<AgentResult<ResearchData>> {
    const capability = stringValue(input.context?.capability) ?? "knowledge";
    switch (capability) {
      case "airports":
        return this.runAirports(input);
      case "flights":
        return this.runFlights(input);
      case "weather":
        return this.runWeather(input);
      case "hotels":
        return this.runHotels(input);
      case "places":
        return this.runPlaces(input);
      case "transportation":
        return this.runTransportation(input);
      case "currency":
        return this.runCurrency(input);
      default:
        return this.runEvidenceSearch(input, capability);
    }
  }

  private async runAirports(
    input: AgentInput,
  ): Promise<AgentResult<ResearchData>> {
    const origin = answer(input, "origin") ?? answer(input, "movingFrom");
    const destination = answer(input, "destination");
    if (!origin || !destination) {
      return {
        status: "NEEDS_INPUT",
        summary: "Airport resolution requires origin and destination.",
        pendingQuestions: [
          ...(!origin ? ["Where are you travelling from?"] : []),
          ...(!destination ? ["Where are you travelling to?"] : []),
        ],
      };
    }
    const response = await this.invokeFirst("airports", {
      capability: "airports",
      operation: "resolve-route",
      input: { origin, destination },
    });
    if (!response.ok || !response.data) return blockedOrFailed(response);
    const route = response.data as AirportRoute;
    return completed(
      response.providerId,
      "airports",
      `Resolved ${origin} to ${route.origin.name} (${route.origin.iataCode}) and ${destination} to ${route.destination.name} (${route.destination.iataCode}).`,
      route,
      [],
    );
  }

  private async runFlights(
    input: AgentInput,
  ): Promise<AgentResult<ResearchData>> {
    const route = resultData(input, "airports");
    const origin = route?.origin;
    const destination = route?.destination;
    if (!isAirport(origin) || !isAirport(destination)) {
      return {
        status: "BLOCKED",
        summary: "Flight search is waiting for verified airport resolution.",
      };
    }
    const departureDate =
      answer(input, "departureDate") ?? answer(input, "targetDate");
    if (!departureDate || !isIsoDate(departureDate)) {
      return {
        status: "BLOCKED",
        summary: "Flight search requires a specific YYYY-MM-DD departure date.",
      };
    }
    const response = await this.invokeFirst("flights", {
      capability: "flights",
      operation: "search",
      input: {
        originLocationCode: origin.iataCode,
        destinationLocationCode: destination.iataCode,
        departureDate,
        returnDate: answer(input, "returnDate"),
        adults: boundedInteger(answer(input, "travelers"), 1, 1, 9),
        travelClass: normalizeTravelClass(answer(input, "cabin")),
        nonStop: answer(input, "directFlights") === "true",
        origin,
        destination,
      },
    });
    if (!response.ok || !response.data) return blockedOrFailed(response);
    const search = response.data as FlightOfferSearch;
    const cheapest = [...search.offers].sort(
      (left, right) => left.totalPrice - right.totalPrice,
    )[0];
    return completed(
      response.providerId,
      "flights",
      cheapest
        ? `${search.offers.length} live flight offer(s) returned; lowest total ${cheapest.currency} ${cheapest.totalPrice.toFixed(2)}.`
        : "The live flight provider returned no offers for the selected route and date.",
      search,
      search.offers.map((offer) => offer.bookingSearchUrl),
    );
  }

  private async runWeather(
    input: AgentInput,
  ): Promise<AgentResult<ResearchData>> {
    const location =
      answer(input, "destination") ?? answer(input, "location");
    const date =
      answer(input, "departureDate") ?? answer(input, "date");
    if (!location || !date || !isIsoDate(date)) {
      return {
        status: "BLOCKED",
        summary:
          "Weather research requires a destination and a specific YYYY-MM-DD date.",
      };
    }
    const response = await this.invokeFirst("weather", {
      capability: "weather",
      operation: "forecast",
      input: { location, date },
    });
    if (!response.ok || !response.data) return blockedOrFailed(response);
    const forecast = response.data as WeatherForecast;
    const summary =
      forecast.status === "FORECAST" && forecast.forecast
        ? `${forecast.location} on ${forecast.requestedDate}: ${forecast.forecast.conditions}, ${forecast.forecast.temperatureMinC}-${forecast.forecast.temperatureMaxC} C, ${forecast.forecast.precipitationProbabilityPercent}% precipitation probability.`
        : `${forecast.location}: ${forecast.note}`;
    return completed(response.providerId, "weather", summary, forecast, [
      "https://open-meteo.com/",
    ]);
  }

  private async runHotels(
    input: AgentInput,
  ): Promise<AgentResult<ResearchData>> {
    const route = resultData(input, "airports");
    const destination = route?.destination;
    if (!isAirport(destination)) {
      return {
        status: "BLOCKED",
        summary: "Hotel search is waiting for a resolved destination city code.",
      };
    }
    const checkInDate =
      answer(input, "departureDate") ?? answer(input, "date");
    if (!checkInDate || !isIsoDate(checkInDate)) {
      return {
        status: "BLOCKED",
        summary: "Hotel search requires a specific check-in date.",
      };
    }
    const checkOutDate =
      answer(input, "returnDate") ?? addDays(checkInDate, 1);
    const response = await this.invokeFirst("hotels", {
      capability: "hotels",
      operation: "search",
      input: {
        destinationCode: destination.iataCode,
        checkInDate,
        checkOutDate,
        adults: boundedInteger(answer(input, "travelers"), 1, 1, 9),
      },
    });
    if (!response.ok || !response.data) return blockedOrFailed(response);
    const search = response.data as HotelOfferSearch;
    const cheapest = [...search.offers].sort(
      (left, right) => left.totalPrice - right.totalPrice,
    )[0];
    return completed(
      response.providerId,
      "hotels",
      cheapest
        ? `${search.offers.length} live hotel offer(s) returned; lowest total ${cheapest.currency} ${cheapest.totalPrice.toFixed(2)}.`
        : "The live hotel provider returned no offers for the selected stay.",
      search,
      search.offers.map((offer) => offer.bookingSearchUrl),
    );
  }

  private async runPlaces(
    input: AgentInput,
  ): Promise<AgentResult<ResearchData>> {
    const weather = resultData(input, "weather");
    const latitude = weather?.latitude;
    const longitude = weather?.longitude;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return {
        status: "BLOCKED",
        summary: "Place research is waiting for resolved destination coordinates.",
      };
    }
    const response = await this.invokeFirst("places", {
      capability: "places",
      operation: "nearby",
      input: { latitude, longitude },
    });
    if (!response.ok || !response.data) return blockedOrFailed(response);
    const places = response.data as NearbyPlaces;
    return completed(
      response.providerId,
      "places",
      places.places.length > 0
        ? `Found ${places.places.length} nearby places: ${places.places
            .slice(0, 5)
            .map((place) => place.title)
            .join(", ")}.`
        : "No nearby places were returned.",
      {
        ...places,
        location: weather?.location,
      },
      ["https://www.openstreetmap.org/"],
    );
  }

  private async runCurrency(
    input: AgentInput,
  ): Promise<AgentResult<ResearchData>> {
    const route = resultData(input, "airports");
    const origin = route?.origin;
    const destination = route?.destination;
    if (!isAirport(origin) || !isAirport(destination)) {
      return {
        status: "BLOCKED",
        summary: "Currency research is waiting for resolved route countries.",
      };
    }
    const response = await this.invokeFirst("currency", {
      capability: "currency",
      operation: "rate",
      input: {
        base: answer(input, "homeCurrency"),
        quote: answer(input, "destinationCurrency"),
        baseCountry: origin.countryName,
        quoteCountry: destination.countryName,
      },
    });
    if (!response.ok || !response.data) return blockedOrFailed(response);
    const currency = response.data as CurrencyEvidence;
    return completed(
      response.providerId,
      "currency",
      `On ${currency.date}, 1 ${currency.base} equalled ${currency.rate} ${currency.quote}.`,
      currency as unknown as Record<string, unknown>,
      [currency.sourceUrl, "https://restcountries.com/"],
    );
  }

  private async runTransportation(
    input: AgentInput,
  ): Promise<AgentResult<ResearchData>> {
    const weather = resultData(input, "weather");
    const latitude = weather?.latitude;
    const longitude = weather?.longitude;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return {
        status: "BLOCKED",
        summary:
          "Transportation research is waiting for resolved destination coordinates.",
      };
    }
    const response = await this.invokeFirst("transportation", {
      capability: "transportation",
      operation: "nearby",
      input: { latitude, longitude },
    });
    if (!response.ok || !response.data) return blockedOrFailed(response);
    const places = response.data as NearbyPlaces;
    return completed(
      response.providerId,
      "transportation",
      places.places.length > 0
        ? `Found ${places.places.length} nearby transport points: ${places.places
            .slice(0, 5)
            .map((place) => place.title)
            .join(", ")}.`
        : "No nearby public-transport points were returned.",
      places as unknown as Record<string, unknown>,
      ["https://www.openstreetmap.org/"],
    );
  }

  private async runEvidenceSearch(
    input: AgentInput,
    capability: string,
  ): Promise<AgentResult<ResearchData>> {
    const providers = this.providers.resolveAll(capability);
    if (providers.length === 0) {
      return {
        status: "BLOCKED",
        summary: `No MCP provider is registered for capability "${capability}".`,
      };
    }
    const query = buildEvidenceQuery(input, capability);
    let lastError = "";
    for (const provider of providers) {
      const response = await provider.invoke({
        capability,
        operation: "search",
        input: {
          query,
          officialOnly: officialEvidenceCapabilities.has(capability),
        },
      });
      if (response.ok && response.data) {
        const data = response.data as EvidenceSearch | KnowledgeSearch;
        const items = Array.isArray(data.items) ? data.items : [];
        const sourceUrls = items
          .map((item) =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as { url?: unknown }).url === "string"
              ? (item as { url: string }).url
              : undefined,
          )
          .filter((url): url is string => Boolean(url));
        return completed(
          provider.id,
          capability,
          items.length > 0
            ? `Found ${items.length} current source(s) for ${capability}.`
            : `No current sources were returned for ${capability}.`,
          data as unknown as Record<string, unknown>,
          sourceUrls,
        );
      }
      lastError = response.error ?? lastError;
      if (response.metadata?.serviceState !== "NOT_CONFIGURED") {
        return { status: "FAILED", summary: lastError };
      }
    }
    return {
      status: "BLOCKED",
      summary:
        lastError || `All providers for "${capability}" are unconfigured.`,
    };
  }

  private async invokeFirst(
    capability: string,
    request: {
      capability: string;
      operation: string;
      input: Record<string, unknown>;
    },
  ): Promise<{
    ok: boolean;
    data?: unknown;
    error?: string;
    metadata?: Record<string, unknown>;
    providerId: string;
  }> {
    const providers = this.providers.resolveAll(capability);
    if (providers.length === 0) {
      return {
        ok: false,
        error: `No MCP provider is registered for capability "${capability}".`,
        metadata: { serviceState: "NOT_CONFIGURED" },
        providerId: "nexus-provider-registry",
      };
    }
    let last: {
      ok: boolean;
      data?: unknown;
      error?: string;
      metadata?: Record<string, unknown>;
      providerId: string;
    } = {
      ok: false,
      error: `No provider completed "${capability}".`,
      metadata: {},
      providerId: providers[0]!.id,
    };
    for (const provider of providers) {
      const response = await provider.invoke(request);
      last = { ...response, providerId: provider.id };
      if (response.ok || response.metadata?.serviceState !== "NOT_CONFIGURED") {
        return last;
      }
    }
    return last;
  }
}

const officialEvidenceCapabilities = new Set([
  "visa",
  "immigration",
  "healthcare",
  "schools",
  "taxes",
  "programs",
  "scholarships",
  "mortgage",
  "crime",
  "medical-visa",
  "customs",
]);

function completed(
  providerId: string,
  capability: string,
  summary: string,
  data: Record<string, unknown>,
  sourceUrls: string[],
): AgentResult<ResearchData> {
  return {
    status: "COMPLETED",
    summary,
    data: {
      providerId,
      capability,
      summary,
      data,
      sourceUrls: [...new Set(sourceUrls)],
      retrievedAt: new Date(),
    },
  };
}

function blockedOrFailed(response: {
  error?: string;
  metadata?: Record<string, unknown>;
}): AgentResult<ResearchData> {
  return {
    status:
      response.metadata?.serviceState === "NOT_CONFIGURED"
        ? "BLOCKED"
        : "FAILED",
    summary: response.error ?? "The provider did not return evidence.",
  };
}

function buildEvidenceQuery(input: AgentInput, capability: string): string {
  if (capability === "knowledge") {
    return [
      input.mission.goal,
      input.mission.setupAnswers.desiredOutcome,
      input.mission.setupAnswers.explorationRequest,
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(" ");
  }
  const facts = Object.entries(input.mission.setupAnswers)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
  return `${capability} research for mission "${input.mission.goal}". ${facts}`.trim();
}

function answer(input: AgentInput, key: string): string | undefined {
  return input.mission.setupAnswers[key]?.trim() || undefined;
}

function resultData(
  input: AgentInput,
  capability: string,
): Record<string, unknown> | undefined {
  return input.mission.researchResults.find(
    (result) => result.capability === capability,
  )?.data;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isAirport(
  value: unknown,
): value is {
  iataCode: string;
  name: string;
  cityName: string;
  countryName: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { iataCode?: unknown }).iataCode === "string" &&
    typeof (value as { countryName?: unknown }).countryName === "string"
  );
}

function isIsoDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
}

function normalizeTravelClass(value: string | undefined):
  | "ECONOMY"
  | "PREMIUM_ECONOMY"
  | "BUSINESS"
  | "FIRST" {
  const normalized = value?.trim().toUpperCase().replaceAll(" ", "_");
  return normalized === "PREMIUM_ECONOMY" ||
    normalized === "BUSINESS" ||
    normalized === "FIRST"
    ? normalized
    : "ECONOMY";
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function findEvidence(
  missionResults: MissionResearchResult[],
  capability: string,
): MissionResearchResult | undefined {
  return missionResults.find((result) => result.capability === capability);
}
