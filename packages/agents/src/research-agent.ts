import type { Agent, AgentInput, AgentResult } from "./index";
import {
  MCPProviderRegistry,
  type KnowledgeSearch,
  type NearbyPlaces,
  type WeatherObservation,
} from "@nexus/mcp-adapters";

export interface WeatherResearchData {
  providerId: string;
  capability: "weather";
  summary: string;
  data: WeatherObservation & {
    mcp: Record<string, unknown>;
  };
}

export interface PlacesResearchData {
  providerId: string;
  capability: "places";
  summary: string;
  data: NearbyPlaces & {
    location: string;
    mcp: Record<string, unknown>;
  };
}

export interface KnowledgeResearchData {
  providerId: string;
  capability: "knowledge";
  summary: string;
  data: KnowledgeSearch & {
    mcp: Record<string, unknown>;
  };
}

export type ResearchData =
  | WeatherResearchData
  | PlacesResearchData
  | KnowledgeResearchData;

export class ResearchAgent implements Agent<ResearchData> {
  readonly id = "research-agent";
  readonly capabilities = ["weather", "places", "knowledge"] as const;

  constructor(private readonly providers: MCPProviderRegistry) {}

  async run(
    input: AgentInput,
  ): Promise<AgentResult<ResearchData>> {
    if (input.context?.capability === "places") {
      return this.runPlaces(input);
    }
    if (input.context?.capability === "knowledge") {
      return this.runKnowledge(input);
    }

    return this.runWeather(input);
  }

  private async runKnowledge(
    input: AgentInput,
  ): Promise<AgentResult<KnowledgeResearchData>> {
    const query = buildKnowledgeQuery(input);
    const provider = this.providers.resolve("knowledge");
    const response = await provider.invoke({
      capability: "knowledge",
      operation: "search",
      input: { query },
    });
    if (!response.ok || !response.data) {
      return {
        status: "FAILED",
        summary: response.error ?? "The knowledge MCP provider failed.",
      };
    }

    const knowledge = response.data as KnowledgeSearch;
    const titles = knowledge.items.map((item) => item.title);
    const summary =
      titles.length > 0
        ? `External background found for "${input.mission.goal}": ${titles.join(", ")}.`
        : `No Wikimedia background pages matched "${input.mission.goal}".`;
    return {
      status: "COMPLETED",
      summary,
      data: {
        providerId: provider.id,
        capability: "knowledge",
        summary,
        data: {
          ...knowledge,
          mcp: response.metadata ?? {},
        },
      },
    };
  }

  private async runWeather(
    input: AgentInput,
  ): Promise<AgentResult<WeatherResearchData>> {
    const location = inferTravelLocation(input);
    if (!location) {
      return {
        status: "NEEDS_INPUT",
        summary: "A destination is required before weather research can run.",
        pendingQuestions: ["What destination should NEXUS research?"],
      };
    }

    const provider = this.providers.resolve("weather");
    const response = await provider.invoke({
      capability: "weather",
      operation: "current",
      input: { location },
    });

    if (!response.ok || !response.data) {
      return {
        status: "FAILED",
        summary: response.error ?? "The weather MCP provider failed.",
      };
    }

    const observation = response.data as WeatherObservation;
    const summary = [
      `Weather in ${observation.location}, ${observation.country}:`,
      `${observation.conditions}, ${observation.temperatureC} C`,
      `(feels like ${observation.apparentTemperatureC} C),`,
      `wind ${observation.windSpeedKph} km/h.`,
      `Observed by Open-Meteo at ${observation.observedAt}`,
      `(${observation.timezone}).`,
    ].join(" ");

    return {
      status: "COMPLETED",
      summary,
      data: {
        providerId: provider.id,
        capability: "weather",
        summary,
        data: {
          ...observation,
          mcp: response.metadata ?? {},
        },
      },
    };
  }

  private async runPlaces(
    input: AgentInput,
  ): Promise<AgentResult<PlacesResearchData>> {
    const weather = input.mission.researchResults.find(
      (result) => result.capability === "weather",
    );
    const latitude = weather?.data.latitude;
    const longitude = weather?.data.longitude;
    const location =
      stringValue(weather?.data.location) ?? inferTravelLocation(input);

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !location
    ) {
      return {
        status: "NEEDS_INPUT",
        summary:
          "Nearby place research requires a resolved travel destination.",
        pendingQuestions: ["What destination should NEXUS research?"],
      };
    }

    const provider = this.providers.resolve("places");
    const response = await provider.invoke({
      capability: "places",
      operation: "nearby",
      input: { latitude, longitude },
    });
    if (!response.ok || !response.data) {
      return {
        status: "FAILED",
        summary: response.error ?? "The places MCP provider failed.",
      };
    }

    const places = response.data as NearbyPlaces;
    const names = places.places.slice(0, 5).map((place) => place.title);
    const summary =
      names.length > 0
        ? `Notable places near ${location}: ${names.join(", ")}.`
        : `No notable Wikimedia places were returned near ${location}.`;

    return {
      status: "COMPLETED",
      summary,
      data: {
        providerId: provider.id,
        capability: "places",
        summary,
        data: {
          ...places,
          location,
          mcp: response.metadata ?? {},
        },
      },
    };
  }
}

function buildKnowledgeQuery(input: AgentInput): string {
  const answers = input.mission.setupAnswers;
  const values = (...keys: string[]) =>
    keys
      .map((key) => answers[key]?.trim())
      .filter((value): value is string => Boolean(value))
      .join(" ");

  switch (input.mission.type) {
    case "RELOCATE":
      return `immigration relocation ${values("destination", "movingFrom")}`.trim();
    case "STUDY_ABROAD":
      return `${values("subject", "studyLevel")} higher education ${values("destination")}`.trim();
    case "BUY_RENT_PROPERTY":
      return `housing property ${values("propertyGoal", "location")}`.trim();
    case "NEW_JOB":
      return `${values("targetRole", "industry")} career`.trim();
    case "PLAN_EVENT":
      return `${values("eventType", "location")} event planning`.trim();
    case "MEDICAL_TRIP":
      return `medical travel logistics ${values("destination")}`.trim();
    case "MOVE_GOODS":
      return `freight transport customs ${values("origin", "destination")}`.trim();
    case "CUSTOM":
      return input.mission.goal;
    case "TRAVEL":
      return `travel ${values("destination")}`.trim();
  }
}

function inferTravelLocation(input: AgentInput): string | undefined {
  const setupAnswers = input.mission.setupAnswers;
  const explicitLocation =
    setupAnswers.destination ?? setupAnswers.location ?? setupAnswers.city;

  if (explicitLocation?.trim()) {
    return explicitLocation.trim();
  }

  const match = input.mission.goal.match(
    /\b(?:to|in)\s+([a-z][a-z .'-]*?)(?=\s+(?:for|from|on|by|during|with|next|this)\b|[,.]|$)/i,
  );

  return match?.[1]?.trim();
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
