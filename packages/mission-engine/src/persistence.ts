import type {
  CreateMissionResearchResultInput,
  CreateMissionInput,
  Mission,
  MissionResearchResult,
  MissionStatus,
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
}
