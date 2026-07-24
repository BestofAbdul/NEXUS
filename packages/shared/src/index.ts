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

export const taskStatuses = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "FAILED",
  "COMPLETED",
] as const;

export type TaskStatus = (typeof taskStatuses)[number];

export type SetupAnswers = Record<string, string>;

export const conversationRoles = ["USER", "AGENT"] as const;

export type ConversationRole = (typeof conversationRoles)[number];

export interface WorkflowTaskDefinition {
  key: string;
  title: string;
  description: string;
  capability: string;
  sequence: number;
  required: boolean;
  inputKeys: string[];
}

export interface Task {
  id: string;
  missionId: string;
  key: string;
  title: string;
  description: string;
  capability: string;
  sequence: number;
  required: boolean;
  status: TaskStatus;
  blockedReason: string | null;
  dueAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
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

export interface MissionConversationMessage {
  id: string;
  missionId: string;
  role: ConversationRole;
  content: string;
  createdAt: Date;
}

export interface TimelineEntry {
  id: string;
  missionId: string;
  taskId: string | null;
  kind:
    | "MISSION_CREATED"
    | "WORKFLOW_CREATED"
    | "STATUS_CHANGED"
    | "TASK_STARTED"
    | "TASK_COMPLETED"
    | "TASK_BLOCKED"
    | "TASK_FAILED"
    | "EVIDENCE_STORED"
    | "RECOMMENDATION_GENERATED"
    | "WAITING_FOR_USER"
    | "NOTE";
  message: string;
  occurredAt: Date;
}

export interface MissionResearchResult {
  id: string;
  missionId: string;
  providerId: string;
  capability: string;
  taskKey: string | null;
  summary: string;
  confidenceScore: number;
  data: Record<string, unknown>;
  sourceUrls: string[];
  retrievedAt: Date;
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
  conversation: MissionConversationMessage[];
  timeline: TimelineEntry[];
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
  taskKey?: string;
  summary: string;
  confidenceScore: number;
  data: Record<string, unknown>;
  sourceUrls?: string[];
  retrievedAt?: Date;
}

export interface CreateTaskInput
  extends Pick<
    WorkflowTaskDefinition,
    | "key"
    | "title"
    | "description"
    | "capability"
    | "sequence"
    | "required"
  > {}

export interface UpdateTaskExecutionInput {
  status: TaskStatus;
  blockedReason?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export type CreateTimelineEntryInput = Pick<
  TimelineEntry,
  "kind" | "message"
> & {
  taskId?: string | null;
};

export type CreateRecommendationInput = Pick<
  Recommendation,
  "title" | "summary" | "rationale" | "rank"
>;

export type CreateCostEstimateInput = Pick<
  CostEstimate,
  "category" | "amount" | "currency" | "notes"
>;

export type CreateConversationMessageInput = Pick<
  MissionConversationMessage,
  "role" | "content"
>;

export interface A2MCPMissionRequest {
  goal: string;
  missionType?: MissionType;
  missionId?: string;
  context?: SetupAnswers;
  action?: A2MCPMissionAction;
  message?: string;
}

export interface A2MCPMissionAction {
  type: "EXPLORE_RECOMMENDATION";
  recommendationId: string;
  query?: string;
}

export interface A2MCPMissionResult
  extends Omit<MissionResearchResult, "createdAt" | "retrievedAt"> {
  createdAt: string;
  retrievedAt: string;
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

export interface A2MCPConversationMessage
  extends Omit<MissionConversationMessage, "createdAt"> {
  createdAt: string;
}

export interface A2MCPTask
  extends Omit<
    Task,
    "createdAt" | "updatedAt" | "dueAt" | "startedAt" | "completedAt"
  > {
  dueAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface A2MCPTimelineEntry
  extends Omit<TimelineEntry, "occurredAt"> {
  occurredAt: string;
}

export interface A2MCPExecutionTaskSummary {
  key: string;
  title: string;
  capability: string;
}

export interface A2MCPBlockedTaskSummary
  extends A2MCPExecutionTaskSummary {
  reason: string;
}

export interface A2MCPEvidenceSummary {
  capability: string;
  providerId: string;
  summary: string;
  confidenceScore: number;
  sourceUrls: string[];
}

export interface A2MCPExecutionSummary {
  completedTasks: A2MCPExecutionTaskSummary[];
  blockedTasks: A2MCPBlockedTaskSummary[];
  failedTasks: A2MCPBlockedTaskSummary[];
  evidenceCollected: A2MCPEvidenceSummary[];
  averageConfidence: number | null;
  pendingActions: string[];
}

export interface A2MCPMissionResponse {
  accepted: boolean;
  missionId: string;
  missionType: MissionType;
  status: MissionStatus;
  progress: number;
  currentActivity: string;
  pendingQuestions: string[];
  results: A2MCPMissionResult[];
  recommendations: A2MCPRecommendation[];
  costBreakdown: A2MCPCostBreakdown;
  tasks: A2MCPTask[];
  notifications: A2MCPNotification[];
  conversation: A2MCPConversationMessage[];
  timeline: A2MCPTimelineEntry[];
  executionSummary: A2MCPExecutionSummary;
}
