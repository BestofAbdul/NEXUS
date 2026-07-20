import { PrismaClient } from "@prisma/client";
import type {
  CreateMissionResearchResultInput,
  CreateMissionInput,
  Mission,
  MissionResearchResult,
  MissionStatus,
  SetupAnswers,
  Task,
  TaskStatus,
  UpdateMissionInput,
} from "@nexus/shared";
import type { MissionRepository } from "./persistence";

type PrismaMission = Awaited<
  ReturnType<PrismaClient["mission"]["findUniqueOrThrow"]>
>;
type PrismaTask = Awaited<ReturnType<PrismaClient["task"]["findUniqueOrThrow"]>>;
type PrismaResearchResult = Awaited<
  ReturnType<PrismaClient["missionResearchResult"]["findUniqueOrThrow"]>
>;

export class PrismaMissionRepository implements MissionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateMissionInput): Promise<Mission> {
    const mission = await this.prisma.mission.create({
      data: {
        title: input.title,
        type: input.type,
        goal: input.goal,
        setupAnswersJson: JSON.stringify(input.setupAnswers ?? {}),
      },
      include: {
        tasks: true,
        researchResults: { orderBy: { createdAt: "asc" } },
      },
    });
    return toMission(mission);
  }

  async findById(id: string): Promise<Mission | null> {
    const mission = await this.prisma.mission.findUnique({
      where: { id },
      include: {
        tasks: true,
        researchResults: { orderBy: { createdAt: "asc" } },
      },
    });
    return mission ? toMission(mission) : null;
  }

  async update(id: string, input: UpdateMissionInput): Promise<Mission> {
    const mission = await this.prisma.mission.update({
      where: { id },
      data: {
        title: input.title,
        goal: input.goal,
        setupAnswersJson: input.setupAnswers
          ? JSON.stringify(input.setupAnswers)
          : undefined,
      },
      include: {
        tasks: true,
        researchResults: { orderBy: { createdAt: "asc" } },
      },
    });
    return toMission(mission);
  }

  async updateStatus(id: string, status: MissionStatus): Promise<Mission> {
    const mission = await this.prisma.mission.update({
      where: { id },
      data: { status },
      include: {
        tasks: true,
        researchResults: { orderBy: { createdAt: "asc" } },
      },
    });
    return toMission(mission);
  }

  async createTask(missionId: string, title: string): Promise<Task> {
    return toTask(
      await this.prisma.task.create({ data: { missionId, title } }),
    );
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    return toTask(
      await this.prisma.task.update({
        where: { id: taskId },
        data: { status },
      }),
    );
  }

  async createResearchResult(
    missionId: string,
    input: CreateMissionResearchResultInput,
  ): Promise<MissionResearchResult> {
    return toResearchResult(
      await this.prisma.missionResearchResult.create({
        data: {
          missionId,
          providerId: input.providerId,
          capability: input.capability,
          summary: input.summary,
          dataJson: JSON.stringify(input.data),
        },
      }),
    );
  }
}

function toMission(
  mission: PrismaMission & {
    tasks: PrismaTask[];
    researchResults: PrismaResearchResult[];
  },
): Mission {
  return {
    id: mission.id,
    title: mission.title,
    type: mission.type as Mission["type"],
    status: mission.status as MissionStatus,
    goal: mission.goal,
    setupAnswers: JSON.parse(mission.setupAnswersJson) as SetupAnswers,
    progress: 0,
    tasks: mission.tasks.map(toTask),
    researchResults: mission.researchResults.map(toResearchResult),
    createdAt: mission.createdAt,
    updatedAt: mission.updatedAt,
  };
}

function toResearchResult(
  result: PrismaResearchResult,
): MissionResearchResult {
  return {
    id: result.id,
    missionId: result.missionId,
    providerId: result.providerId,
    capability: result.capability,
    summary: result.summary,
    data: JSON.parse(result.dataJson) as Record<string, unknown>,
    createdAt: result.createdAt,
  };
}

function toTask(task: PrismaTask): Task {
  return {
    id: task.id,
    missionId: task.missionId,
    title: task.title,
    status: task.status as TaskStatus,
    dueAt: task.dueAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
