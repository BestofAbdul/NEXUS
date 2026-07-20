import { PrismaClient } from "@prisma/client";
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
type PrismaRecommendation = Awaited<
  ReturnType<PrismaClient["recommendation"]["findUniqueOrThrow"]>
>;
type PrismaCostEstimate = Awaited<
  ReturnType<PrismaClient["costEstimate"]["findUniqueOrThrow"]>
>;
type PrismaNotification = Awaited<
  ReturnType<PrismaClient["missionNotification"]["findUniqueOrThrow"]>
>;

const missionIncludes = {
  tasks: true,
  researchResults: { orderBy: { createdAt: "asc" as const } },
  recommendations: { orderBy: { rank: "asc" as const } },
  costEstimates: { orderBy: { createdAt: "asc" as const } },
  notifications: { orderBy: { createdAt: "asc" as const } },
};

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
      include: missionIncludes,
    });
    return toMission(mission);
  }

  async findById(id: string): Promise<Mission | null> {
    const mission = await this.prisma.mission.findUnique({
      where: { id },
      include: missionIncludes,
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
      include: missionIncludes,
    });
    return toMission(mission);
  }

  async updateStatus(id: string, status: MissionStatus): Promise<Mission> {
    const mission = await this.prisma.mission.update({
      where: { id },
      data: { status },
      include: missionIncludes,
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

  async createRecommendations(
    missionId: string,
    inputs: CreateRecommendationInput[],
  ): Promise<Recommendation[]> {
    await this.prisma.recommendation.createMany({
      data: inputs.map((input) => ({ missionId, ...input })),
    });
    return (
      await this.prisma.recommendation.findMany({
        where: { missionId },
        orderBy: { rank: "asc" },
      })
    ).map(toRecommendation);
  }

  async createCostEstimates(
    missionId: string,
    inputs: CreateCostEstimateInput[],
  ): Promise<CostEstimate[]> {
    await this.prisma.costEstimate.createMany({
      data: inputs.map((input) => ({ missionId, ...input })),
    });
    return (
      await this.prisma.costEstimate.findMany({
        where: { missionId },
        orderBy: { createdAt: "asc" },
      })
    ).map(toCostEstimate);
  }

  async createNotification(
    missionId: string,
    message: string,
  ): Promise<MissionNotification> {
    return toNotification(
      await this.prisma.missionNotification.upsert({
        where: { missionId_message: { missionId, message } },
        create: { missionId, message },
        update: {},
      }),
    );
  }
}

function toMission(
  mission: PrismaMission & {
    tasks: PrismaTask[];
    researchResults: PrismaResearchResult[];
    recommendations: PrismaRecommendation[];
    costEstimates: PrismaCostEstimate[];
    notifications: PrismaNotification[];
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
    recommendations: mission.recommendations.map(toRecommendation),
    costEstimates: mission.costEstimates.map(toCostEstimate),
    notifications: mission.notifications.map(toNotification),
    createdAt: mission.createdAt,
    updatedAt: mission.updatedAt,
  };
}

function toRecommendation(item: PrismaRecommendation): Recommendation {
  return {
    id: item.id,
    missionId: item.missionId,
    title: item.title,
    summary: item.summary,
    rationale: item.rationale,
    rank: item.rank,
    createdAt: item.createdAt,
  };
}

function toCostEstimate(item: PrismaCostEstimate): CostEstimate {
  return {
    id: item.id,
    missionId: item.missionId,
    category: item.category,
    amount: item.amount,
    currency: item.currency,
    notes: item.notes,
    createdAt: item.createdAt,
  };
}

function toNotification(item: PrismaNotification): MissionNotification {
  return {
    id: item.id,
    missionId: item.missionId,
    message: item.message,
    createdAt: item.createdAt,
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
