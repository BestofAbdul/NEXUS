import type {
  CostEstimate,
  CreateCostEstimateInput,
  CreateRecommendationInput,
  CreateMissionResearchResultInput,
  CreateMissionInput,
  Mission,
  MissionNotification,
  MissionResearchResult,
  MissionStatus,
  Recommendation,
  Task,
  UpdateMissionInput,
} from "@nexus/shared";

export interface MissionRepository {
  create(input: CreateMissionInput): Promise<Mission>;
  findById(id: string): Promise<Mission | null>;
  update(id: string, input: UpdateMissionInput): Promise<Mission>;
  updateStatus(id: string, status: MissionStatus): Promise<Mission>;
  createTask(missionId: string, title: string): Promise<Task>;
  updateTaskStatus(taskId: string, status: Task["status"]): Promise<Task>;
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
}
