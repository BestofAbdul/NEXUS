import type {
  CreateRecommendationInput,
  Mission,
  MissionResearchResult,
  MissionType,
} from "@nexus/shared";
import type { Agent, AgentInput, AgentResult } from "./index";

type RecommendationBuilder = (
  mission: Mission,
) => CreateRecommendationInput[];

const builders: Record<MissionType, RecommendationBuilder> = {
  TRAVEL: buildTravelRecommendations,
  RELOCATE: (mission) =>
    contextualRecommendations(mission, [
      [
        "Choose the relocation pathway before choosing a city",
        `Compare eligibility, processing time, and work rights for ${answer(mission, "destination", "the destination")} before committing to housing or moving costs.`,
        "Immigration pathway constraints can change every later decision.",
      ],
      [
        "Compare settlement options against your real priorities",
        `Score cities or neighborhoods using ${answer(mission, "priorities", "housing cost, work access, transport, and community")}.`,
        "A structured comparison prevents the most visible city from becoming the automatic choice.",
      ],
      [
        "Build the move backward from the target date",
        `Use ${answer(mission, "targetDate", "your intended move date")} to sequence documents, notice periods, housing, and travel.`,
        "Relocation dependencies are easier to manage as one dated plan.",
      ],
    ]),
  STUDY_ABROAD: (mission) =>
    contextualRecommendations(mission, [
      [
        "Shortlist programs by fit, not reputation alone",
        `Prioritize ${answer(mission, "subject", "your subject")} programs at ${answer(mission, "studyLevel", "the intended level")} that match budget, entry profile, and career outcome.`,
        "Program fit and admission probability matter more than a generic ranking.",
      ],
      [
        "Treat funding and admission as parallel workstreams",
        `Map tuition, living costs, scholarships, and proof-of-funds against the ${answer(mission, "intake", "target intake")}.`,
        "Funding deadlines often arrive before final admission or visa steps.",
      ],
      [
        "Create one evidence checklist",
        "Track transcripts, references, language tests, personal statements, passport, and visa evidence in one place.",
        "A unified checklist reduces missed dependencies across institutions.",
      ],
    ]),
  BUY_RENT_PROPERTY: (mission) =>
    contextualRecommendations(mission, [
      [
        "Turn preferences into a scored property brief",
        `Separate must-haves from trade-offs for ${answer(mission, "location", "the target area")}, including ${answer(mission, "priorities", "budget, space, safety, and commute")}.`,
        "A scored brief makes viewings comparable and reduces emotional decisions.",
      ],
      [
        "Budget beyond the advertised price",
        `Keep the ${answer(mission, "budget", "stated budget")} ceiling inclusive of deposits, fees, utilities, moving, repairs, and recurring charges.`,
        "Headline price alone understates the real affordability decision.",
      ],
      [
        "Verify before committing",
        "Check ownership or lease terms, condition, neighborhood at different times, transport, and all written obligations.",
        "NEXUS recommends; the human and qualified professionals verify and execute.",
      ],
    ]),
  NEW_JOB: (mission) =>
    contextualRecommendations(mission, [
      [
        "Position around a specific role outcome",
        `Lead with evidence relevant to ${answer(mission, "targetRole", "the target role")} in ${answer(mission, "industry", "the chosen industry")}, not a generic career summary.`,
        "Focused positioning improves application relevance and interview clarity.",
      ],
      [
        "Build a deliberate target list",
        `Prioritize employers matching ${answer(mission, "preferences", "location, growth, compensation, and working-style preferences")}.`,
        "A smaller researched list supports stronger applications than mass submission.",
      ],
      [
        "Prepare proof before interviews",
        "Write concise stories showing scope, decisions, measurable outcomes, conflict handling, and learning.",
        "Reusable evidence makes interview answers specific rather than improvised.",
      ],
    ]),
  PLAN_EVENT: (mission) =>
    contextualRecommendations(mission, [
      [
        "Lock the guest experience before suppliers",
        `Define what ${answer(mission, "guestCount", "the expected guests")} should experience at the ${answer(mission, "eventType", "event")}.`,
        "The experience brief guides venue, schedule, food, and entertainment decisions.",
      ],
      [
        "Protect the critical path",
        `Confirm venue, date, and high-dependency suppliers first for ${answer(mission, "date", "the target date")}.`,
        "Late critical-path decisions create expensive downstream changes.",
      ],
      [
        "Create an owner and fallback for every live moment",
        "Assign setup, guest arrival, program transitions, payments, safety, teardown, and contingency ownership.",
        "Events fail at handoffs more often than at ideas.",
      ],
    ]),
  MEDICAL_TRIP: (mission) =>
    contextualRecommendations(mission, [
      [
        "Verify clinical instructions directly",
        `Confirm timing, preparation, recovery, and fitness-to-travel with the licensed provider for ${answer(mission, "appointmentType", "the appointment")}.`,
        "NEXUS handles logistics only and must not replace medical advice.",
      ],
      [
        "Plan around accessibility and recovery",
        `Use ${answer(mission, "accessibility", "the stated mobility and support needs")} to select travel, accommodation, and companion arrangements.`,
        "The easiest itinerary is more valuable than the cheapest when recovery is involved.",
      ],
      [
        "Keep documents and contacts redundant",
        "Carry provider details, prescriptions, insurance records, identification, emergency contacts, and digital backups.",
        "Redundancy reduces risk when traveling for care.",
      ],
    ]),
  MOVE_GOODS: (mission) =>
    contextualRecommendations(mission, [
      [
        "Classify the shipment before comparing carriers",
        `Document ${answer(mission, "items", "the goods")}, dimensions, weight, value, fragility, and restrictions from ${answer(mission, "origin", "origin")} to ${answer(mission, "destination", "destination")}.`,
        "Accurate shipment data determines route, customs, packing, and quote validity.",
      ],
      [
        "Compare total landed cost and responsibility",
        "Evaluate pickup, packing, freight, customs, duties, insurance, storage, and final delivery together.",
        "The lowest freight quote can become the highest total cost.",
      ],
      [
        "Create evidence at every handoff",
        "Photograph condition, label every package, keep inventory copies, and record tracking and delivery acceptance.",
        "A documented chain of custody improves issue resolution.",
      ],
    ]),
  CUSTOM: (mission) =>
    contextualRecommendations(mission, [
      [
        "Define a measurable finish line",
        `Translate "${mission.goal}" into an outcome with a deadline and a clear acceptance test.`,
        "A mission is actionable only when completion can be recognized.",
      ],
      [
        "Resolve the highest-impact unknown first",
        `Start with constraints and preferences: ${answer(mission, "preferences", "none provided yet")}.`,
        "Early uncertainty reduction prevents wasted downstream work.",
      ],
      [
        "Create the smallest useful next action",
        "Choose one action that produces evidence or removes a blocker without requiring payment or irreversible commitment.",
        "Small evidence-producing steps preserve momentum and human control.",
      ],
    ]),
};

export class RecommendationAgent
  implements Agent<CreateRecommendationInput[]>
{
  readonly id = "recommendation-agent";
  readonly capabilities = ["recommendations"] as const;

  async run(
    input: AgentInput,
  ): Promise<AgentResult<CreateRecommendationInput[]>> {
    const recommendations = builders[input.mission.type](input.mission);
    return {
      status: "COMPLETED",
      summary: `Prepared ${recommendations.length} recommendations for "${input.mission.goal}".`,
      data: recommendations,
    };
  }
}

function buildTravelRecommendations(
  mission: Mission,
): CreateRecommendationInput[] {
  const weather = findResult(mission, "weather");
  const places = findResult(mission, "places");
  const location =
    stringValue(weather?.data.location) ??
    answer(mission, "destination", "the destination");
  const conditions = stringValue(weather?.data.conditions) ?? "current conditions";
  const temperature = numberValue(weather?.data.temperatureC);
  const nearbyPlaces = Array.isArray(places?.data.places)
    ? places.data.places
        .slice(0, 4)
        .map((place) =>
          typeof place === "object" &&
          place !== null &&
          typeof (place as { title?: unknown }).title === "string"
            ? (place as { title: string }).title
            : undefined,
        )
        .filter((value): value is string => Boolean(value))
    : [];
  const weatherAdvice =
    temperature === undefined
      ? "Pack adaptable layers and recheck the forecast."
      : temperature >= 28
        ? "Plan shade and hydration breaks and carry sun protection."
        : temperature <= 10
          ? "Pack insulated layers and allow extra time for cold conditions."
          : "Pack light layers and one weather-resistant outer layer.";

  return [
    {
      rank: 1,
      title: `Build the route around ${nearbyPlaces[0] ?? location}`,
      summary:
        nearbyPlaces.length > 0
          ? `Start with ${nearbyPlaces.join(", ")} and group nearby stops into the same day. Match the route to: ${answer(mission, "preferences", "a balanced local experience")}.`
          : `Build a flexible route in ${location} around the user's stated interests: ${answer(mission, "preferences", "local highlights")}.`,
      rationale:
        nearbyPlaces.length > 0
          ? `Based on real nearby-place results returned by ${places?.providerId}.`
          : "Based on the submitted destination and preferences.",
    },
    {
      rank: 2,
      title: "Adapt the daily plan to current conditions",
      summary: `${weatherAdvice} Current conditions in ${location} are ${conditions}.`,
      rationale: weather
        ? `Based on persisted weather evidence from ${weather.providerId}.`
        : "Weather should be verified before departure.",
    },
    {
      rank: 3,
      title: "Protect the trip with decision checkpoints",
      summary: `Before acting, verify entry rules, opening hours, local transport, accommodation, and the ${answer(mission, "budget", "working budget")}.`,
      rationale:
        "These checks convert research into a usable trip while preserving the no-booking boundary.",
    },
  ];
}

function contextualRecommendations(
  mission: Mission,
  items: Array<[string, string, string]>,
): CreateRecommendationInput[] {
  return items.map(([title, summary, rationale], index) => ({
    rank: index + 1,
    title,
    summary,
    rationale: `${rationale} Mission goal: "${mission.goal}".`,
  }));
}

function answer(mission: Mission, key: string, fallback: string): string {
  return mission.setupAnswers[key]?.trim() || fallback;
}

function findResult(
  mission: Mission,
  capability: string,
): MissionResearchResult | undefined {
  return mission.researchResults.find(
    (result) => result.capability === capability,
  );
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
