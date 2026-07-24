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
import { assertMissionTransition, calculateMissionProgress } from "./lifecycle";
import type { MissionRepository } from "./persistence";

export class MissionService {
  constructor(private readonly repository: MissionRepository) {}

  async createMission(input: CreateMissionInput): Promise<Mission> {
    return this.withProgress(await this.repository.create(input));
  }

  async getMission(id: string): Promise<Mission | null> {
    const mission = await this.repository.findById(id);
    return mission ? this.withProgress(mission) : null;
  }

  async updateMission(id: string, input: UpdateMissionInput): Promise<Mission> {
    return this.withProgress(await this.repository.update(id, input));
  }

  async transitionMission(id: string, nextStatus: MissionStatus): Promise<Mission> {
    const mission = await this.requireMission(id);
    assertMissionTransition(mission.status, nextStatus);
    return this.withProgress(await this.repository.updateStatus(id, nextStatus));
  }

  async addTask(missionId: string, input: CreateTaskInput): Promise<Task> {
    await this.requireMission(missionId);
    return this.repository.createTask(missionId, input);
  }

  updateTaskStatus(taskId: string, status: Task["status"]): Promise<Task> {
    return this.repository.updateTaskExecution(taskId, { status });
  }

  updateTaskExecution(
    taskId: string,
    input: UpdateTaskExecutionInput,
  ): Promise<Task> {
    return this.repository.updateTaskExecution(taskId, input);
  }

  async addResearchResult(
    missionId: string,
    input: CreateMissionResearchResultInput,
  ): Promise<MissionResearchResult> {
    await this.requireMission(missionId);
    return this.repository.createResearchResult(missionId, input);
  }

  async addRecommendations(
    missionId: string,
    inputs: CreateRecommendationInput[],
  ): Promise<Recommendation[]> {
    await this.requireMission(missionId);
    return this.repository.createRecommendations(missionId, inputs);
  }

  async addCostEstimates(
    missionId: string,
    inputs: CreateCostEstimateInput[],
  ): Promise<CostEstimate[]> {
    await this.requireMission(missionId);
    return this.repository.createCostEstimates(missionId, inputs);
  }

  async addNotification(
    missionId: string,
    message: string,
  ): Promise<MissionNotification> {
    await this.requireMission(missionId);
    return this.repository.createNotification(missionId, message);
  }

  async addConversationMessage(
    missionId: string,
    input: CreateConversationMessageInput,
  ): Promise<MissionConversationMessage> {
    await this.requireMission(missionId);
    return this.repository.createConversationMessage(missionId, input);
  }

  async addTimelineEntry(
    missionId: string,
    input: CreateTimelineEntryInput,
  ): Promise<TimelineEntry> {
    await this.requireMission(missionId);
    return this.repository.createTimelineEntry(missionId, input);
  }

  async resetMissionOutputs(missionId: string): Promise<void> {
    await this.requireMission(missionId);
    await this.repository.resetMissionOutputs(missionId);
  }

  private async requireMission(id: string): Promise<Mission> {
    const mission = await this.repository.findById(id);
    if (!mission) {
      throw new Error(`Mission not found: ${id}`);
    }

    return mission;
  }

  private withProgress(mission: Mission): Mission {
    return {
      ...mission,
      progress: calculateMissionProgress(mission.status, mission.tasks),
    };
  }
}
