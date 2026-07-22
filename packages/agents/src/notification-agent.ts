import type { Agent, AgentInput, AgentResult } from "./index";

export interface NotificationAgentContext {
  stage:
    | "MISSION_PLANNED"
    | "RESEARCH_COMPLETED"
    | "MISSION_ANALYSIS_COMPLETED";
}

export class NotificationAgent implements Agent<string> {
  readonly id = "notification-agent";
  readonly capabilities = ["notifications"] as const;

  async run(input: AgentInput): Promise<AgentResult<string>> {
    const context = input.context as NotificationAgentContext | undefined;
    const message =
      context?.stage === "MISSION_PLANNED"
        ? `Mission plan created for: ${input.mission.goal}`
        : context?.stage === "RESEARCH_COMPLETED"
          ? `External research completed for: ${input.mission.goal}`
          : `Recommendations, tasks, and informational costs are ready for: ${input.mission.goal}`;

    return {
      status: "COMPLETED",
      summary: message,
      data: message,
    };
  }
}
