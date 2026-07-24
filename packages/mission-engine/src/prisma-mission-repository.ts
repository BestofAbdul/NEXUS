import { PrismaClient } from "@prisma/client";
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
  SetupAnswers,
  Task,
  TaskStatus,
  TimelineEntry,
  UpdateTaskExecutionInput,
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
type PrismaConversationMessage = Awaited<
  ReturnType<
    PrismaClient["missionConversationMessage"]["findUniqueOrThrow"]
  >
>;
type PrismaTimelineEntry = Awaited<
  ReturnType<PrismaClient["timelineEntry"]["findUniqueOrThrow"]>
>;

const missionIncludes = {
  tasks: true,
  researchResults: { orderBy: { createdAt: "asc" as const } },
  recommendations: { orderBy: { rank: "asc" as const } },
  costEstimates: { orderBy: { createdAt: "asc" as const } },
  notifications: { orderBy: { createdAt: "asc" as const } },
  conversation: { orderBy: { createdAt: "asc" as const } },
  timeline: { orderBy: { occurredAt: "asc" as const } },
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

  async createTask(missionId: string, input: CreateTaskInput): Promise<Task> {
    return toTask(
      await this.prisma.task.upsert({
        where: { missionId_key: { missionId, key: input.key } },
        create: { missionId, ...input },
        update: {
          title: input.title,
          description: input.description,
          capability: input.capability,
          sequence: input.sequence,
          required: input.required,
        },
      }),
    );
  }

  async updateTaskExecution(
    taskId: string,
    input: UpdateTaskExecutionInput,
  ): Promise<Task> {
    return toTask(
      await this.prisma.task.update({
        where: { id: taskId },
        data: input,
      }),
    );
  }

  async createResearchResult(
    missionId: string,
    input: CreateMissionResearchResultInput,
  ): Promise<MissionResearchResult> {
    const data = {
      providerId: input.providerId,
      capability: input.capability,
      taskKey: input.taskKey,
      summary: input.summary,
      confidenceScore: input.confidenceScore,
      dataJson: JSON.stringify(input.data),
      sourceUrlsJson: JSON.stringify(input.sourceUrls ?? []),
      retrievedAt: input.retrievedAt ?? new Date(),
    };
    return toResearchResult(
      input.taskKey
        ? await this.prisma.missionResearchResult.upsert({
            where: {
              missionId_taskKey: { missionId, taskKey: input.taskKey },
            },
            create: { missionId, ...data },
            update: data,
          })
        : await this.prisma.missionResearchResult.create({
            data: { missionId, ...data },
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

  async createConversationMessage(
    missionId: string,
    input: CreateConversationMessageInput,
  ): Promise<MissionConversationMessage> {
    return toConversationMessage(
      await this.prisma.missionConversationMessage.create({
        data: { missionId, ...input },
      }),
    );
  }

  async createTimelineEntry(
    missionId: string,
    input: CreateTimelineEntryInput,
  ): Promise<TimelineEntry> {
    return toTimelineEntry(
      await this.prisma.timelineEntry.create({
        data: {
          missionId,
          taskId: input.taskId,
          kind: input.kind,
          message: input.message,
        },
      }),
    );
  }

  async resetMissionOutputs(missionId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.task.deleteMany({ where: { missionId } }),
      this.prisma.missionResearchResult.deleteMany({ where: { missionId } }),
      this.prisma.recommendation.deleteMany({ where: { missionId } }),
      this.prisma.costEstimate.deleteMany({ where: { missionId } }),
      this.prisma.missionNotification.deleteMany({ where: { missionId } }),
    ]);
  }
}

function toMission(
  mission: PrismaMission & {
    tasks: PrismaTask[];
    researchResults: PrismaResearchResult[];
    recommendations: PrismaRecommendation[];
    costEstimates: PrismaCostEstimate[];
    notifications: PrismaNotification[];
    conversation: PrismaConversationMessage[];
    timeline: PrismaTimelineEntry[];
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
    conversation: mission.conversation.map(toConversationMessage),
    timeline: mission.timeline.map(toTimelineEntry),
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

function toConversationMessage(
  item: PrismaConversationMessage,
): MissionConversationMessage {
  return {
    id: item.id,
    missionId: item.missionId,
    role: item.role as MissionConversationMessage["role"],
    content: item.content,
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
    taskKey: result.taskKey,
    summary: result.summary,
    confidenceScore: result.confidenceScore,
    data: JSON.parse(result.dataJson) as Record<string, unknown>,
    sourceUrls: JSON.parse(result.sourceUrlsJson) as string[],
    retrievedAt: result.retrievedAt,
    createdAt: result.createdAt,
  };
}

function toTask(task: PrismaTask): Task {
  return {
    id: task.id,
    missionId: task.missionId,
    key: task.key ?? task.id,
    title: task.title,
    description: task.description,
    capability: task.capability,
    sequence: task.sequence,
    required: task.required,
    status: task.status as TaskStatus,
    blockedReason: task.blockedReason,
    dueAt: task.dueAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function toTimelineEntry(entry: PrismaTimelineEntry): TimelineEntry {
  return {
    id: entry.id,
    missionId: entry.missionId,
    taskId: entry.taskId,
    kind: entry.kind as TimelineEntry["kind"],
    message: entry.message,
    occurredAt: entry.occurredAt,
  };
}
