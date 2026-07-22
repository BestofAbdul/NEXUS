import type { MissionType } from "@nexus/shared";
import type { Agent, AgentInput, AgentResult } from "./index";

export interface MissionPlanData {
  providerId: "nexus-mission-planner";
  capability: "mission-plan";
  summary: string;
  data: {
    missionType: MissionType;
    goal: string;
    interpretedPreferences: string[];
    focusAreas: string[];
  };
  tasks: string[];
}

interface MissionBlueprint {
  focusAreas: string[];
  tasks: string[];
}

const blueprints: Record<MissionType, MissionBlueprint> = {
  TRAVEL: {
    focusAreas: ["destination conditions", "places to explore", "trip readiness"],
    tasks: [
      "Confirm travel dates and entry requirements",
      "Shortlist places and build a flexible daily route",
      "Verify transport, accommodation, and final budget",
    ],
  },
  RELOCATE: {
    focusAreas: ["eligibility", "housing", "work and settlement"],
    tasks: [
      "Confirm the most suitable relocation pathway",
      "Compare target cities, housing, and monthly living costs",
      "Build a document and moving timeline",
    ],
  },
  STUDY_ABROAD: {
    focusAreas: ["program fit", "admissions", "funding and visa"],
    tasks: [
      "Shortlist programs that match the subject and study level",
      "Map admission, language, and document requirements",
      "Build an application, funding, and visa timeline",
    ],
  },
  BUY_RENT_PROPERTY: {
    focusAreas: ["location fit", "affordability", "property checks"],
    tasks: [
      "Define the non-negotiable property criteria",
      "Compare neighborhoods against budget and commute needs",
      "Prepare viewing questions and due-diligence checks",
    ],
  },
  NEW_JOB: {
    focusAreas: ["role positioning", "target employers", "application execution"],
    tasks: [
      "Define the target role and strongest positioning",
      "Create a focused employer and opportunity list",
      "Tailor application materials and interview preparation",
    ],
  },
  PLAN_EVENT: {
    focusAreas: ["guest experience", "venue and suppliers", "run of show"],
    tasks: [
      "Confirm scope, guest count, and event priorities",
      "Build a venue and supplier shortlist",
      "Create the schedule, responsibility list, and contingency plan",
    ],
  },
  MEDICAL_TRIP: {
    focusAreas: ["non-clinical logistics", "accessibility", "recovery support"],
    tasks: [
      "Confirm appointment and provider logistics directly",
      "Plan accessible travel, accommodation, and companion support",
      "Prepare documents, recovery time, and emergency contacts",
    ],
  },
  MOVE_GOODS: {
    focusAreas: ["route options", "documentation", "handling and delivery"],
    tasks: [
      "Create an itemized shipment inventory",
      "Compare route, carrier, customs, and insurance requirements",
      "Prepare packing, handoff, tracking, and delivery checks",
    ],
  },
  CUSTOM: {
    focusAreas: ["desired outcome", "constraints", "next actions"],
    tasks: [
      "Define the measurable mission outcome",
      "Research the highest-impact unknowns",
      "Sequence the next actions and decision points",
    ],
  },
};

export class MissionPlannerAgent implements Agent<MissionPlanData> {
  readonly id = "mission-planner-agent";
  readonly capabilities = ["mission-planning"] as const;

  async run(input: AgentInput): Promise<AgentResult<MissionPlanData>> {
    const blueprint = blueprints[input.mission.type];
    const preferences = Object.entries(input.mission.setupAnswers)
      .filter(([, value]) => value.trim().length > 0)
      .map(([key, value]) => `${humanize(key)}: ${value}`);
    const summary = `NEXUS interpreted "${input.mission.goal}" as a ${humanize(
      input.mission.type,
    ).toLowerCase()} mission focused on ${blueprint.focusAreas.join(", ")}${
      preferences.length > 0 ? `, using ${preferences.join("; ")}` : ""
    }.`;

    return {
      status: "COMPLETED",
      summary,
      data: {
        providerId: "nexus-mission-planner",
        capability: "mission-plan",
        summary,
        data: {
          missionType: input.mission.type,
          goal: input.mission.goal,
          interpretedPreferences: preferences,
          focusAreas: blueprint.focusAreas,
        },
        tasks: blueprint.tasks.map((task) =>
          personalizeTask(task, input.mission.setupAnswers),
        ),
      },
    };
  }
}

function personalizeTask(
  task: string,
  context: Record<string, string>,
): string {
  const destination = context.destination ?? context.location;
  return destination ? `${task} for ${destination}` : task;
}

function humanize(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
