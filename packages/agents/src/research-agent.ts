import type { MissionResearchResult } from "@nexus/shared";
import {
  MCPProviderRegistry,
  type AirportRoute,
  type CurrencyEvidence,
  type CountryResolution,
  type EvidenceCrawl,
  type EvidenceExtract,
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
  confidenceScore: number;
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
    if (this.providers.resolveAll("airports").length === 0) {
      return {
        status: "BLOCKED",
        summary: "No airport provider configured",
      };
    }
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
      0.95,
    );
  }

  private async runFlights(
    input: AgentInput,
  ): Promise<AgentResult<ResearchData>> {
    if (this.providers.resolveAll("flights").length === 0) {
      return {
        status: "BLOCKED",
        summary: "No flight provider configured",
      };
    }
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
      0.95,
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
    ], forecast.status === "FORECAST" ? 0.95 : 0.9);
  }

  private async runHotels(
    input: AgentInput,
  ): Promise<AgentResult<ResearchData>> {
    if (this.providers.resolveAll("hotels").length === 0) {
      return {
        status: "BLOCKED",
        summary: "No hotel provider configured",
      };
    }
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
      0.95,
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
      0.85,
    );
  }

  private async runCurrency(
    input: AgentInput,
  ): Promise<AgentResult<ResearchData>> {
    const route = resultData(input, "airports");
    const origin = route?.origin;
    const destination = route?.destination;
    const baseCountry = isAirport(origin)
      ? origin.countryName
      : answer(input, "origin") ?? answer(input, "movingFrom");
    const quoteCountry = isAirport(destination)
      ? destination.countryName
      : answer(input, "destination") ?? answer(input, "location");
    if (!baseCountry || !quoteCountry) {
      return {
        status: "BLOCKED",
        summary: "Currency research requires origin and destination countries.",
      };
    }
    const baseResolution = await this.invokeFirst("countries", {
      capability: "countries",
      operation: "resolve",
      input: { name: baseCountry },
    });
    if (!baseResolution.ok || !baseResolution.data) {
      return {
        status:
          baseResolution.metadata?.reason === "COUNTRY_NOT_FOUND"
            ? "BLOCKED"
            : "FAILED",
        summary:
          baseResolution.metadata?.reason === "COUNTRY_NOT_FOUND"
            ? `Could not resolve origin country or currency from "${baseCountry}".`
            : `Origin country resolution failed: ${baseResolution.error ?? "unknown provider error"}`,
      };
    }
    const quoteResolution = await this.invokeFirst("countries", {
      capability: "countries",
      operation: "resolve",
      input: { name: quoteCountry },
    });
    if (!quoteResolution.ok || !quoteResolution.data) {
      return {
        status:
          quoteResolution.metadata?.reason === "COUNTRY_NOT_FOUND"
            ? "BLOCKED"
            : "FAILED",
        summary:
          quoteResolution.metadata?.reason === "COUNTRY_NOT_FOUND"
            ? `Could not resolve destination country or currency from "${quoteCountry}".`
            : `Destination country resolution failed: ${quoteResolution.error ?? "unknown provider error"}`,
      };
    }
    const base = baseResolution.data as CountryResolution;
    const quote = quoteResolution.data as CountryResolution;
    const response = await this.invokeFirst("currency", {
      capability: "currency",
      operation: "rate",
      input: {
        base: answer(input, "homeCurrency") ?? base.currencyCode,
        quote: answer(input, "destinationCurrency") ?? quote.currencyCode,
      },
    });
    if (!response.ok || !response.data) return blockedOrFailed(response);
    const currency = response.data as CurrencyEvidence;
    return completed(
      response.providerId,
      "currency",
      `On ${currency.date}, 1 ${currency.base} equalled ${currency.rate} ${currency.quote}; country metadata resolved ${baseCountry} to ${base.countryName} and ${quoteCountry} to ${quote.countryName}.`,
      {
        ...currency,
        originCountry: base,
        destinationCountry: quote,
      },
      [currency.sourceUrl, base.sourceUrl, quote.sourceUrl],
      0.95,
    );
  }

  private async runTransportation(
    input: AgentInput,
  ): Promise<AgentResult<ResearchData>> {
    const weather = resultData(input, "weather");
    const latitude = weather?.latitude;
    const longitude = weather?.longitude;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return this.runEvidenceSearch(input, "transportation");
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
      0.85,
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
    const queries = evidenceQueries(input, capability);
    let lastError = "";
    for (const provider of providers) {
      const searches: Array<EvidenceSearch | KnowledgeSearch> = [];
      const enrichmentWarnings: string[] = [];
      for (const query of queries) {
        const response = await provider.invoke({
          capability,
          operation: "search",
          input: {
            query,
            officialOnly: officialEvidenceCapabilities.has(capability),
            excludeDomains: excludedDomainsForCapability(capability),
          },
        });
        if (response.ok && response.data) {
          searches.push(response.data as EvidenceSearch | KnowledgeSearch);
          continue;
        }
        lastError = response.error ?? lastError;
        if (searches.length > 0) {
          enrichmentWarnings.push(
            `A secondary search could not complete: ${response.error ?? "unknown provider error"}`,
          );
          break;
        }
        if (response.metadata?.serviceState !== "NOT_CONFIGURED") {
          return { status: "FAILED", summary: lastError };
        }
      }

      if (searches.length === 0) continue;

      const items = deduplicateEvidenceItems(searches.flatMap(readItems));
      const sourceUrls = evidenceSourceUrls(items);
      const primaryQuery = queries[0]!;
      let extraction: EvidenceExtract | undefined;
      let crawl: EvidenceCrawl | undefined;

      if (sourceUrls.length > 0) {
        const extractResponse = await provider.invoke({
          capability,
          operation: "extract",
          input: {
            query: primaryQuery,
            urls: sourceUrls.slice(0, 3),
          },
        });
        if (extractResponse.ok && extractResponse.data) {
          extraction = extractResponse.data as EvidenceExtract;
        } else if (!isUnsupportedOperation(extractResponse.error)) {
          enrichmentWarnings.push(
            `Source extraction was unavailable: ${extractResponse.error ?? "unknown provider error"}`,
          );
        }
      }

      if (booleanValue(input.context?.deepResearch) && sourceUrls[0]) {
        const crawlResponse = await provider.invoke({
          capability,
          operation: "crawl",
          input: {
            query: primaryQuery,
            url: sourceUrls[0],
          },
        });
        if (crawlResponse.ok && crawlResponse.data) {
          crawl = crawlResponse.data as EvidenceCrawl;
        } else if (!isUnsupportedOperation(crawlResponse.error)) {
          enrichmentWarnings.push(
            `Deep crawl was unavailable: ${crawlResponse.error ?? "unknown provider error"}`,
          );
        }
      }

      const answers = searches
        .map(readAnswer)
        .filter((answer): answer is string => Boolean(answer));
      const allSourceUrls = [
        ...sourceUrls,
        ...(extraction?.items.map((item) => item.url) ?? []),
        ...(crawl?.items.map((item) => item.url) ?? []),
      ];
      const summary =
        citationLinkedSummary(answers, items, capability) ||
        `No current sources were returned for ${capability}.`;

      return completed(
        provider.id,
        capability,
        summary,
        {
          source: provider.id,
          capability,
          query: primaryQuery,
          queries,
          answer: answers.join(" "),
          items,
          searches,
          extraction: extraction ?? null,
          crawl: crawl ?? null,
          verification: {
            searchCount: searches.length,
            sourceCount: new Set(allSourceUrls).size,
            extractedSourceCount: extraction?.items.length ?? 0,
            crawledPageCount: crawl?.items.length ?? 0,
            enrichmentWarnings,
          },
        },
        allSourceUrls,
        evidenceConfidence(items),
      );
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
      if (response.ok) {
        return last;
      }
      const shouldTryNext =
        response.metadata?.serviceState === "NOT_CONFIGURED" ||
        response.error?.startsWith("Unsupported ");
      if (!shouldTryNext) return last;
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
  confidenceScore: number,
): AgentResult<ResearchData> {
  return {
    status: "COMPLETED",
    summary,
    data: {
      providerId,
      capability,
      summary,
      confidenceScore,
      data,
      sourceUrls: [...new Set(sourceUrls)],
      retrievedAt: new Date(),
    },
  };
}

function extractiveEvidenceSummary(
  items: Array<Record<string, unknown>>,
  capability: string,
): string {
  const excerpts = items
    .map((item) =>
      typeof item.excerpt === "string" ? item.excerpt.trim() : "",
    )
    .filter(Boolean)
    .slice(0, 3);
  return excerpts.length > 0
    ? excerpts.join(" ")
    : `Found ${items.length} current source(s) for ${capability}.`;
}

function citationLinkedSummary(
  answers: string[],
  items: Array<Record<string, unknown>>,
  capability: string,
): string {
  if (answers.length > 0) {
    return answers
      .slice(0, 2)
      .map((answer, index) => `${answer} [Evidence set ${index + 1}]`)
      .join(" ");
  }
  const summary = extractiveEvidenceSummary(items, capability);
  return items.length > 0 ? `${summary} [Sources 1-${items.length}]` : summary;
}

function evidenceConfidence(items: Array<Record<string, unknown>>): number {
  const scores = items
    .map((item) => item.score)
    .filter((score): score is number => typeof score === "number")
    .map((score) => Math.min(1, Math.max(0, score)));
  if (scores.length === 0) return 0.6;
  return roundConfidence(
    scores.reduce((total, score) => total + score, 0) / scores.length,
  );
}

function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
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
  const relevantKeys =
    capabilityQueryFields[capability] ?? capabilityQueryFields.knowledge;
  const facts = relevantKeys
    .map((key) => [key, input.mission.setupAnswers[key]?.trim()] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${humanizeQueryKey(key)}: ${value}`);
  const fallback =
    input.mission.setupAnswers.explorationRequest?.trim() ||
    input.mission.setupAnswers.desiredOutcome?.trim() ||
    input.mission.goal.trim();
  return [
    `Current ${capability.replaceAll("-", " ")} evidence`,
    facts.length > 0 ? facts.join("; ") : fallback,
  ]
    .filter(Boolean)
    .join(". ");
}

const capabilityQueryFields: Record<string, string[]> = {
  visa: ["origin", "movingFrom", "nationality", "destination"],
  immigration: [
    "movingFrom",
    "origin",
    "nationality",
    "destination",
    "workStatus",
  ],
  "medical-visa": [
    "origin",
    "nationality",
    "destination",
    "appointmentType",
  ],
  "government-documents": [
    "origin",
    "movingFrom",
    "destination",
    "nationality",
  ],
  jobs: ["targetRole", "workStatus", "location", "destination", "industry"],
  employers: ["targetRole", "location", "destination", "industry"],
  salary: ["targetRole", "location", "destination", "experience"],
  universities: ["destination", "subject", "studyLevel", "intake"],
  programs: ["destination", "subject", "studyLevel", "intake"],
  scholarships: ["destination", "subject", "studyLevel", "intake", "budget"],
  housing: ["destination", "location", "household", "budget", "targetDate"],
  accommodation: [
    "destination",
    "location",
    "departureDate",
    "returnDate",
    "budget",
  ],
  properties: [
    "propertyGoal",
    "location",
    "budget",
    "bedrooms",
    "moveDate",
  ],
  mortgage: ["propertyGoal", "location", "budget"],
  neighbourhood: ["location", "destination", "priorities"],
  crime: ["location", "destination"],
  schools: ["location", "destination", "household", "studyLevel"],
  healthcare: ["destination", "location", "household", "workStatus"],
  hospitals: ["destination", "appointmentType", "accessibility"],
  doctors: ["destination", "appointmentType"],
  insurance: [
    "origin",
    "destination",
    "appointmentType",
    "items",
    "timeline",
  ],
  recovery: ["destination", "appointmentType", "accessibility", "dates"],
  taxes: ["movingFrom", "destination", "workStatus", "propertyGoal"],
  venues: ["eventType", "location", "date", "guestCount", "budget"],
  suppliers: ["eventType", "location", "date", "guestCount", "budget"],
  events: ["eventType", "location", "date", "guestCount"],
  freight: ["origin", "destination", "items", "timeline", "volume"],
  customs: ["origin", "destination", "items", "timeline"],
  transportation: [
    "origin",
    "destination",
    "location",
    "date",
    "timeline",
  ],
  relocation: [
    "movingFrom",
    "destination",
    "workStatus",
    "household",
    "targetDate",
  ],
  knowledge: [
    "desiredOutcome",
    "explorationRequest",
    "deadline",
    "constraints",
  ],
};

const nonTechnicalResearchCapabilities = new Set([
  ...Object.keys(capabilityQueryFields),
  "weather",
  "places",
]);

function excludedDomainsForCapability(capability: string): string[] {
  return nonTechnicalResearchCapabilities.has(capability)
    ? [
        "stackoverflow.com",
        "stackexchange.com",
        "superuser.com",
        "serverfault.com",
      ]
    : [];
}

function humanizeQueryKey(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase();
}

function evidenceQueries(input: AgentInput, capability: string): string[] {
  const focusedQueries = stringArray(input.context?.queries)
    .map((query) => query.trim())
    .filter(Boolean)
    .slice(0, 2);
  return focusedQueries.length > 0
    ? [...new Set(focusedQueries)]
    : [buildEvidenceQuery(input, capability)];
}

function readItems(
  data: EvidenceSearch | KnowledgeSearch,
): Array<Record<string, unknown>> {
  return Array.isArray(data.items)
    ? (data.items as unknown[]).filter(isRecord)
    : [];
}

function readAnswer(
  data: EvidenceSearch | KnowledgeSearch,
): string | undefined {
  return "answer" in data && typeof data.answer === "string"
    ? data.answer.trim() || undefined
    : undefined;
}

function evidenceSourceUrls(items: Array<Record<string, unknown>>): string[] {
  return items
    .map((item) => (typeof item.url === "string" ? item.url : undefined))
    .filter((url): url is string => Boolean(url));
}

function deduplicateEvidenceItems(
  items: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key =
      typeof item.url === "string"
        ? item.url
        : JSON.stringify([item.title, item.excerpt]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function isUnsupportedOperation(error: string | undefined): boolean {
  return error?.startsWith("Unsupported ") ?? false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
