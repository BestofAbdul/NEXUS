import type {
  CreateRecommendationInput,
  MissionResearchResult,
} from "@nexus/shared";
import type { Agent, AgentInput, AgentResult } from "./index";

export class RecommendationAgent
  implements Agent<CreateRecommendationInput[]>
{
  readonly id = "recommendation-agent";
  readonly capabilities = ["recommendations"] as const;

  async run(
    input: AgentInput,
  ): Promise<AgentResult<CreateRecommendationInput[]>> {
    const weather = input.mission.researchResults.find(
      (result) => result.capability === "weather",
    );

    if (!weather) {
      return {
        status: "NEEDS_INPUT",
        summary: "Recommendations require completed destination research.",
      };
    }

    const data = weather.data;
    const location = stringValue(data.location) ?? "the destination";
    const conditions = stringValue(data.conditions) ?? "current conditions";
    const temperatureC = numberValue(data.temperatureC);
    const recommendations = buildRecommendations(
      weather,
      location,
      conditions,
      temperatureC,
    );

    return {
      status: "COMPLETED",
      summary: `Prepared ${recommendations.length} ranked recommendations for ${location}.`,
      data: recommendations,
    };
  }
}

function buildRecommendations(
  weather: MissionResearchResult,
  location: string,
  conditions: string,
  temperatureC: number | undefined,
): CreateRecommendationInput[] {
  const temperatureAdvice =
    temperatureC === undefined
      ? "Pack layers suited to changing conditions."
      : temperatureC >= 28
        ? "Prioritize hydration, sun protection, and breathable clothing."
        : temperatureC <= 10
          ? "Pack insulated layers and allow for cold-weather delays."
          : "Pack light layers and one weather-resistant outer layer.";

  return [
    {
      rank: 1,
      title: "Prepare for observed destination weather",
      summary: `${temperatureAdvice} Current conditions in ${location} are ${conditions}.`,
      rationale: `Based on persisted weather evidence from ${weather.providerId}, observed at ${stringValue(weather.data.observedAt) ?? "the provider timestamp"}.`,
    },
    {
      rank: 2,
      title: "Keep the itinerary flexible",
      summary:
        "Leave buffer time around outdoor plans and identify an indoor alternative.",
      rationale:
        "Weather observations can change after planning; flexibility reduces disruption without requiring NEXUS to book anything.",
    },
    {
      rank: 3,
      title: "Recheck conditions before departure",
      summary:
        "Confirm the latest forecast and any local advisories shortly before travel.",
      rationale:
        "The current MCP result is a real point-in-time observation, not a guarantee of future conditions.",
    },
  ];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
