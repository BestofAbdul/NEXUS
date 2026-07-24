import type {
  CostEstimate,
  CreateCostEstimateInput,
  CreateConversationMessageInput,
  CreateTaskInput,
  CreateTimelineEntryInput,
  CreateRecommendationInput,
  CreateMissionResearchResultInput,
  CreateMissionInput,
  Mission,
  MissionNotification,
  MissionConversationMessage,
  MissionResearchResult,
  MissionStatus,
  Recommendation,
  Task,
  TimelineEntry,
  UpdateTaskExecutionInput,
  UpdateMissionInput,
} from "@nexus/shared";

export interface MissionRepository {
  create(input: CreateMissionInput): Promise<Mission>;
  findById(id: string): Promise<Mission | null>;
  update(id: string, input: UpdateMissionInput): Promise<Mission>;
  updateStatus(id: string, status: MissionStatus): Promise<Mission>;
  createTask(missionId: string, input: CreateTaskInput): Promise<Task>;
  updateTaskExecution(
    taskId: string,
    input: UpdateTaskExecutionInput,
  ): Promise<Task>;
  createResearchResult(
    missionId: string,
    input: CreateMissionResearchResultInput,
  ): Promise<MissionResearchResult>;
  createRecommendations(
    missionId: string,
    inputs: CreateRecommendationInput[],
  ): Promise<Recommendation[]>;
  createCostEstimates(
    missionId: string,
    inputs: CreateCostEstimateInput[],
  ): Promise<CostEstimate[]>;
  createNotification(
    missionId: string,
    message: string,
  ): Promise<MissionNotification>;
  createConversationMessage(
    missionId: string,
    input: CreateConversationMessageInput,
  ): Promise<MissionConversationMessage>;
  createTimelineEntry(
    missionId: string,
    input: CreateTimelineEntryInput,
  ): Promise<TimelineEntry>;
  resetMissionOutputs(missionId: string): Promise<void>;
}
