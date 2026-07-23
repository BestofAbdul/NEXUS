import type { Mission } from "@nexus/shared";

export interface AgentInput {
  mission: Mission;
  objective: string;
  context?: Record<string, unknown>;
}

export interface AgentResult<TData = unknown> {
  status: "COMPLETED" | "NEEDS_INPUT" | "BLOCKED" | "FAILED";
  summary: string;
  data?: TData;
  pendingQuestions?: string[];
}

export interface Agent<TData = unknown> {
  readonly id: string;
  readonly capabilities: readonly string[];
  run(input: AgentInput): Promise<AgentResult<TData>>;
}

export * from "./mission-orchestrator";
export * from "./mission-planner-agent";
export * from "./research-agent";
export * from "./recommendation-agent";
export * from "./cost-analysis-agent";
export * from "./notification-agent";
export * from "./workflow-definitions";
