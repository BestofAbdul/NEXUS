import type { Agent, AgentInput, AgentResult } from "./index";

export interface NotificationAgentContext {
  stage: "RESEARCH_COMPLETED" | "MISSION_ANALYSIS_COMPLETED";
}

export class NotificationAgent implements Agent<string> {
  readonly id = "notification-agent";
  readonly capabilities = ["notifications"] as const;

  async run(input: AgentInput): Promise<AgentResult<string>> {
    const context = input.context as NotificationAgentContext | undefined;
    const message =
      context?.stage === "RESEARCH_COMPLETED"
        ? "Destination weather research completed through MCP."
        : "Recommendations and informational cost analysis are ready for human review.";

    return {
      status: "COMPLETED",
      summary: message,
      data: message,
    };
  }
}
