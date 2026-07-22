import type {
  CreateCostEstimateInput,
  Mission,
  MissionType,
} from "@nexus/shared";
import type { Agent, AgentInput, AgentResult } from "./index";

type CostBuilder = (mission: Mission) => CreateCostEstimateInput[];

const builders: Record<MissionType, CostBuilder> = {
  TRAVEL: buildTravelCosts,
  RELOCATE: (mission) => [
    item("Documents and applications", 500, mission, "Verify official fees."),
    item("Travel and initial transport", 900, mission, "Planning allowance only."),
    item("Housing setup", 1800, mission, "Deposit and initial setup allowance."),
    item("Settlement contingency", 800, mission, "Buffer for early-stage costs."),
  ],
  STUDY_ABROAD: (mission) => [
    item("Applications and tests", 450, mission, "Varies by institution and test."),
    item("Visa and documents", 500, mission, "Verify official requirements."),
    item("Travel and arrival", 1000, mission, "Planning allowance only."),
    item("Initial living buffer", 1500, mission, "Excludes tuition."),
  ],
  BUY_RENT_PROPERTY: (mission) => [
    item("Search and viewing", 150, mission, "Transport and document allowance."),
    item("Professional checks", 600, mission, "Legal or inspection placeholder."),
    item("Moving and setup", 900, mission, "Varies by property and distance."),
    item("Contingency", 500, mission, "Do not treat as a quote."),
  ],
  NEW_JOB: (mission) => [
    item("Application materials", 100, mission, "Optional tools or printing."),
    item("Interview preparation", 150, mission, "Learning and practice allowance."),
    item("Networking and transport", 200, mission, "Planning allowance."),
    item("Transition buffer", 500, mission, "Optional contingency."),
  ],
  PLAN_EVENT: (mission) => {
    const guests = boundedNumber(mission.setupAnswers.guestCount, 50, 1, 1000);
    return [
      item("Venue allowance", 750, mission, "Research estimate only."),
      item("Food and refreshments", guests * 20, mission, `${guests} guests.`),
      item("Program and suppliers", 500, mission, "Equipment and supplier buffer."),
      item("Contingency", Math.max(250, guests * 5), mission, "Unexpected costs."),
    ];
  },
  MEDICAL_TRIP: (mission) => [
    item("Travel", 800, mission, "Non-clinical travel planning only."),
    item("Accessible accommodation", 700, mission, "Verify recovery requirements."),
    item("Local transport and support", 300, mission, "Accessibility allowance."),
    item("Contingency", 500, mission, "Excludes medical treatment fees."),
  ],
  MOVE_GOODS: (mission) => [
    item("Packing materials", 200, mission, "Depends on item type and volume."),
    item("Freight allowance", 900, mission, "Not a carrier quote."),
    item("Customs and handling", 350, mission, "Verify route-specific charges."),
    item("Insurance and contingency", 300, mission, "Human approval required."),
  ],
  CUSTOM: (mission) => [
    item("Research allowance", 100, mission, "Optional information-gathering costs."),
    item("Execution preparation", 250, mission, "Placeholder based on current scope."),
    item("Contingency", 150, mission, "Refine after research."),
  ],
};

export class CostAnalysisAgent implements Agent<CreateCostEstimateInput[]> {
  readonly id = "cost-analysis-agent";
  readonly capabilities = ["cost-analysis"] as const;

  async run(
    input: AgentInput,
  ): Promise<AgentResult<CreateCostEstimateInput[]>> {
    const estimates = builders[input.mission.type](input.mission);
    const total = estimates.reduce((sum, cost) => sum + cost.amount, 0);
    return {
      status: "COMPLETED",
      summary: `Prepared a personalized informational ${total} USD planning estimate for "${input.mission.goal}".`,
      data: estimates,
    };
  }
}

function buildTravelCosts(mission: Mission): CreateCostEstimateInput[] {
  const days = boundedNumber(
    mission.setupAnswers.duration ?? mission.goal.match(/\b(\d{1,2})[- ]day\b/i)?.[1],
    5,
    1,
    30,
  );
  const travelers = boundedNumber(mission.setupAnswers.travelers, 1, 1, 20);
  return [
    item("Local transport", days * 15 * travelers, mission, `${days} days.`),
    item("Meals", days * 50 * travelers, mission, `${travelers} traveler(s).`),
    item("Activities", days * 30 * travelers, mission, "Adjust to preferences."),
    item("Contingency", 100 * travelers, mission, "No booking or payment."),
  ];
}

function item(
  category: string,
  amount: number,
  mission: Mission,
  note: string,
): CreateCostEstimateInput {
  const budget = mission.setupAnswers.budget?.trim();
  return {
    category,
    amount,
    currency: "USD",
    notes: `${note}${budget ? ` User budget: ${budget}.` : ""}`,
  };
}

function boundedNumber(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, minimum), maximum)
    : fallback;
}
