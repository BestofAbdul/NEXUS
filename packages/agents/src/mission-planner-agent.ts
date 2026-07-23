import type {
  MissionType,
  WorkflowTaskDefinition,
} from "@nexus/shared";
import type { Agent, AgentInput, AgentResult } from "./index";
import { getMissionWorkflow } from "./workflow-definitions";

export interface MissionPlanData {
  providerId: "nexus-mission-planner";
  capability: "mission-plan";
  summary: string;
  data: {
    missionType: MissionType;
    goal: string;
    interpretedPreferences: string[];
    workflowCapabilities: string[];
  };
  tasks: WorkflowTaskDefinition[];
}

export class MissionPlannerAgent implements Agent<MissionPlanData> {
  readonly id = "mission-planner-agent";
  readonly capabilities = ["mission-planning"] as const;

  async run(input: AgentInput): Promise<AgentResult<MissionPlanData>> {
    const workflow = getMissionWorkflow(input.mission.type);
    const preferences = Object.entries(input.mission.setupAnswers)
      .filter(([, value]) => value.trim().length > 0)
      .map(([key, value]) => `${humanize(key)}: ${value}`);
    const capabilities = workflow.tasks.map((task) => task.capability);
    const summary = `NEXUS created a ${humanize(
      input.mission.type,
    ).toLowerCase()} workflow with ${workflow.tasks.length} ordered tasks: ${capabilities.join(", ")}.`;

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
          workflowCapabilities: capabilities,
        },
        tasks: workflow.tasks,
      },
    };
  }
}

function humanize(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
