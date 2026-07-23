import type {
  CreateCostEstimateInput,
  MissionResearchResult,
} from "@nexus/shared";
import type { Agent, AgentInput, AgentResult } from "./index";

export class CostAnalysisAgent implements Agent<CreateCostEstimateInput[]> {
  readonly id = "cost-analysis-agent";
  readonly capabilities = ["cost-analysis"] as const;

  async run(
    input: AgentInput,
  ): Promise<AgentResult<CreateCostEstimateInput[]>> {
    const estimates = input.mission.researchResults.flatMap(extractCosts);
    if (estimates.length === 0) {
      return {
        status: "BLOCKED",
        summary:
          "No provider-backed prices are available yet. NEXUS will not create a budget from assumptions.",
      };
    }

    return {
      status: "COMPLETED",
      summary: `Built a budget from ${estimates.length} provider-backed price item(s).`,
      data: deduplicateCosts(estimates),
    };
  }
}

function extractCosts(
  result: MissionResearchResult,
): CreateCostEstimateInput[] {
  if (result.capability === "flights" && Array.isArray(result.data.offers)) {
    const offers = result.data.offers.filter(isPricedItem);
    const lowest = [...offers].sort(
      (left, right) => left.totalPrice - right.totalPrice,
    )[0];
    return lowest
      ? [
          {
            category: "Lowest live flight offer",
            amount: lowest.totalPrice,
            currency: lowest.currency,
            notes: `Provider: ${result.providerId}. Retrieved ${result.retrievedAt.toISOString()}. Verify before booking.`,
          },
        ]
      : [];
  }

  if (result.capability === "hotels" && Array.isArray(result.data.offers)) {
    const offers = result.data.offers.filter(isPricedItem);
    const lowest = [...offers].sort(
      (left, right) => left.totalPrice - right.totalPrice,
    )[0];
    return lowest
      ? [
          {
            category: "Lowest live hotel offer",
            amount: lowest.totalPrice,
            currency: lowest.currency,
            notes: `Provider: ${result.providerId}. Retrieved ${result.retrievedAt.toISOString()}. Verify before booking.`,
          },
        ]
      : [];
  }

  return [];
}

function isPricedItem(
  value: unknown,
): value is { totalPrice: number; currency: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { totalPrice?: unknown }).totalPrice === "number" &&
    typeof (value as { currency?: unknown }).currency === "string"
  );
}

function deduplicateCosts(
  inputs: CreateCostEstimateInput[],
): CreateCostEstimateInput[] {
  return [
    ...new Map(inputs.map((input) => [input.category, input])).values(),
  ];
}
