export const missionTypes = [
  "TRAVEL",
  "RELOCATE",
  "STUDY_ABROAD",
  "BUY_RENT_PROPERTY",
  "NEW_JOB",
  "PLAN_EVENT",
  "MEDICAL_TRIP",
  "MOVE_GOODS",
  "CUSTOM",
] as const;

export type MissionType = (typeof missionTypes)[number];

export const missionStatuses = ["DRAFT", "ACTIVE", "READY"] as const;

export type MissionStatus = (typeof missionStatuses)[number];

export const taskStatuses = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as const;

export type TaskStatus = (typeof taskStatuses)[number];

export type SetupAnswers = Record<string, string>;

export interface Task {
  id: string;
  missionId: string;
  title: string;
  status: TaskStatus;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Recommendation {
  id: string;
  missionId: string;
  title: string;
  summary: string;
  rationale: string;
  rank: number;
  createdAt: Date;
}

export interface CostEstimate {
  id: string;
  missionId: string;
  category: string;
  amount: number;
  currency: string;
  notes: string | null;
  createdAt: Date;
}

export interface MissionNotification {
  id: string;
  missionId: string;
  message: string;
  createdAt: Date;
}

export interface TimelineEntry {
  id: string;
  missionId: string;
  kind: "MISSION_CREATED" | "STATUS_CHANGED" | "TASK_COMPLETED" | "NOTE";
  message: string;
  occurredAt: Date;
}

export interface MissionResearchResult {
  id: string;
  missionId: string;
  providerId: string;
  capability: string;
  summary: string;
  data: Record<string, unknown>;
  createdAt: Date;
}

export interface Mission {
  id: string;
  title: string;
  type: MissionType;
  status: MissionStatus;
  goal: string;
  setupAnswers: SetupAnswers;
  progress: number;
  tasks: Task[];
  researchResults: MissionResearchResult[];
  recommendations: Recommendation[];
  costEstimates: CostEstimate[];
  notifications: MissionNotification[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMissionInput {
  title: string;
  type: MissionType;
  goal: string;
  setupAnswers?: SetupAnswers;
}

export interface UpdateMissionInput {
  title?: string;
  goal?: string;
  setupAnswers?: SetupAnswers;
}

export interface CreateMissionResearchResultInput {
  providerId: string;
  capability: string;
  summary: string;
  data: Record<string, unknown>;
}

export type CreateRecommendationInput = Pick<
  Recommendation,
  "title" | "summary" | "rationale" | "rank"
>;

export type CreateCostEstimateInput = Pick<
  CostEstimate,
  "category" | "amount" | "currency" | "notes"
>;

export interface A2MCPMissionRequest {
  goal: string;
  missionType?: MissionType;
  missionId?: string;
  context?: SetupAnswers;
}

export interface A2MCPMissionResult
  extends Omit<MissionResearchResult, "createdAt"> {
  createdAt: string;
}

export interface A2MCPRecommendation
  extends Omit<Recommendation, "createdAt"> {
  createdAt: string;
}

export interface A2MCPCostLineItem
  extends Omit<CostEstimate, "createdAt"> {
  createdAt: string;
}

export interface A2MCPCostBreakdown {
  currency: string;
  lineItems: A2MCPCostLineItem[];
  total: number;
  disclaimer: string;
}

export interface A2MCPNotification
  extends Omit<MissionNotification, "createdAt"> {
  createdAt: string;
}

export interface A2MCPMissionResponse {
  accepted: boolean;
  missionId: string;
  status: MissionStatus;
  progress: number;
  currentActivity: string;
  pendingQuestions: string[];
  results: A2MCPMissionResult[];
  recommendations: A2MCPRecommendation[];
  costBreakdown: A2MCPCostBreakdown;
  notifications: A2MCPNotification[];
}
