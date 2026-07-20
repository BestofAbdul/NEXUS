import type { Agent, AgentInput, AgentResult } from "./index";
import {
  MCPProviderRegistry,
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

export class ResearchAgent implements Agent<WeatherResearchData> {
  readonly id = "research-agent";
  readonly capabilities = ["weather"] as const;

  constructor(private readonly providers: MCPProviderRegistry) {}

  async run(
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
