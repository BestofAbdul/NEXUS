import type { CreateCostEstimateInput } from "@nexus/shared";
import type { Agent, AgentInput, AgentResult } from "./index";

export class CostAnalysisAgent implements Agent<CreateCostEstimateInput[]> {
  readonly id = "cost-analysis-agent";
  readonly capabilities = ["cost-analysis"] as const;

  async run(
    input: AgentInput,
  ): Promise<AgentResult<CreateCostEstimateInput[]>> {
    const durationDays = inferDurationDays(input.mission.goal);
    const estimates: CreateCostEstimateInput[] = [
      {
        category: "Local transport",
        amount: durationDays * 15,
        currency: "USD",
        notes: `${durationDays}-day planning allowance; verify local fares before acting.`,
      },
      {
        category: "Meals",
        amount: durationDays * 50,
        currency: "USD",
        notes: `${durationDays}-day mid-range planning allowance; excludes prepaid meals.`,
      },
      {
        category: "Weather preparation",
        amount: 40,
        currency: "USD",
        notes: "Optional allowance for destination-appropriate clothing or supplies.",
      },
      {
        category: "Contingency",
        amount: 100,
        currency: "USD",
        notes: "Informational buffer only; NEXUS never initiates payment.",
      },
    ];

    const total = estimates.reduce((sum, item) => sum + item.amount, 0);
    return {
      status: "COMPLETED",
      summary: `Prepared an informational ${total} USD mission budget estimate.`,
      data: estimates,
    };
  }
}

function inferDurationDays(goal: string): number {
  const match = goal.match(/\b(\d{1,2})[- ]day\b/i);
  if (!match) {
    return 5;
  }

  return Math.min(Math.max(Number(match[1]), 1), 30);
}
