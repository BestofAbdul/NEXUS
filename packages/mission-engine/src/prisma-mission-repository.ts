import { PrismaClient } from "@prisma/client";
import type {
  CreateMissionInput,
  Mission,
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
      include: { tasks: true },
    });
    return toMission(mission);
  }

  async findById(id: string): Promise<Mission | null> {
    const mission = await this.prisma.mission.findUnique({
      where: { id },
      include: { tasks: true },
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
      include: { tasks: true },
    });
    return toMission(mission);
  }

  async updateStatus(id: string, status: MissionStatus): Promise<Mission> {
    const mission = await this.prisma.mission.update({
      where: { id },
      data: { status },
      include: { tasks: true },
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
}

function toMission(mission: PrismaMission & { tasks: PrismaTask[] }): Mission {
  return {
    id: mission.id,
    title: mission.title,
    type: mission.type as Mission["type"],
    status: mission.status as MissionStatus,
    goal: mission.goal,
    setupAnswers: JSON.parse(mission.setupAnswersJson) as SetupAnswers,
    progress: 0,
    tasks: mission.tasks.map(toTask),
    createdAt: mission.createdAt,
    updatedAt: mission.updatedAt,
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
