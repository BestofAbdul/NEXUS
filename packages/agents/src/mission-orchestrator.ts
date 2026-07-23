import type {
  Mission,
  Task,
  WorkflowTaskDefinition,
} from "@nexus/shared";
import { MissionService } from "@nexus/mission-engine";
import { CostAnalysisAgent } from "./cost-analysis-agent";
import { MissionPlannerAgent } from "./mission-planner-agent";
import { NotificationAgent } from "./notification-agent";
import { RecommendationAgent } from "./recommendation-agent";
import { ResearchAgent, type ResearchData } from "./research-agent";
import { getBlockingQuestions } from "./workflow-definitions";

export interface MissionOrchestrationResult {
  mission: Mission;
  currentActivity: string;
  pendingQuestions: string[];
}

const internalCapabilities = new Set(["budget", "recommendations"]);

export class MissionOrchestrator {
  constructor(
    private readonly missionService: MissionService,
    private readonly missionPlannerAgent: MissionPlannerAgent,
    private readonly researchAgent: ResearchAgent,
    private readonly recommendationAgent: RecommendationAgent,
    private readonly costAnalysisAgent: CostAnalysisAgent,
    private readonly notificationAgent: NotificationAgent,
  ) {}

  async run(mission: Mission): Promise<MissionOrchestrationResult> {
    let workingMission = mission;
    await this.ensureMissionCreatedEvent(workingMission);

    const pendingQuestions = getBlockingQuestions(workingMission);
    if (pendingQuestions.length > 0) {
      await this.appendTimelineOnce(
        workingMission,
        "WAITING_FOR_USER",
        `Waiting for required mission input: ${pendingQuestions.join(" ")}`,
      );
      workingMission = await this.requireUpdatedMission(workingMission.id);
      return {
        mission: workingMission,
        currentActivity:
          "Mission created. Workflow execution is waiting for required input.",
        pendingQuestions,
      };
    }

    if (workingMission.tasks.length === 0) {
      workingMission = await this.createWorkflow(workingMission);
    }

    const researchTasks = workingMission.tasks
      .filter((task) => !internalCapabilities.has(task.capability))
      .sort(bySequence);
    for (const task of researchTasks) {
      if (task.status === "COMPLETED") continue;
      workingMission = await this.executeResearchTask(workingMission, task);
    }

    workingMission = await this.executeBudgetTask(workingMission);
    workingMission = await this.executeRecommendationTask(workingMission);
    workingMission = await this.finalizeMission(workingMission);

    const pending = workingMission.tasks.filter(
      (task) => task.required && task.status !== "COMPLETED",
    );
    const blockedCount = workingMission.tasks.filter(
      (task) => task.status === "BLOCKED",
    ).length;
    const failedCount = workingMission.tasks.filter(
      (task) => task.status === "FAILED",
    ).length;
    const completedCount = workingMission.tasks.filter(
      (task) => task.status === "COMPLETED",
    ).length;
    const next = pending[0];
    return {
      mission: workingMission,
      currentActivity:
        workingMission.status === "READY"
          ? blockedCount + failedCount === 0
            ? `${humanize(workingMission.type)} mission is ready from verified evidence.`
            : `${humanize(workingMission.type)} mission is ready with ${completedCount} completed, ${blockedCount} blocked, and ${failedCount} failed task(s).`
          : next?.blockedReason
            ? `${next.title}: ${next.blockedReason}`
            : next
              ? `${next.title} is waiting to run.`
              : "Mission execution is active.",
      pendingQuestions: [],
    };
  }

  private async createWorkflow(mission: Mission): Promise<Mission> {
    const plan = await this.missionPlannerAgent.run({
      mission,
      objective: "Create the mission-specific executable workflow.",
    });
    if (plan.status !== "COMPLETED" || !plan.data) {
      throw new Error(plan.summary);
    }
    await this.missionService.addResearchResult(mission.id, {
      providerId: plan.data.providerId,
      capability: plan.data.capability,
      taskKey: "workflow-plan",
      summary: plan.data.summary,
      confidenceScore: plan.data.confidenceScore,
      data: plan.data.data,
      sourceUrls: [],
    });
    for (const task of plan.data.tasks) {
      await this.missionService.addTask(mission.id, toCreateTask(task));
    }
    await this.missionService.addTimelineEntry(mission.id, {
      kind: "WORKFLOW_CREATED",
      message: `Created ${plan.data.tasks.length} ordered workflow tasks for ${humanize(mission.type)}.`,
    });
    return this.requireUpdatedMission(mission.id);
  }

  private async executeResearchTask(
    mission: Mission,
    task: Task,
  ): Promise<Mission> {
    await this.startTask(mission, task);
    const currentMission = await this.requireUpdatedMission(mission.id);
    const result = await this.researchAgent.run({
      mission: currentMission,
      objective: task.description,
      context: {
        capability: task.capability,
        taskKey: task.key,
        taskTitle: task.title,
      },
    });

    if (result.status === "COMPLETED" && result.data) {
      await this.persistEvidence(mission.id, task, result.data);
      await this.completeTask(mission.id, task, result.summary);
    } else if (result.status === "NEEDS_INPUT") {
      await this.blockTask(
        mission.id,
        task,
        `${result.summary} ${(result.pendingQuestions ?? []).join(" ")}`.trim(),
      );
    } else if (result.status === "BLOCKED") {
      await this.blockTask(mission.id, task, result.summary);
    } else {
      await this.failTask(mission.id, task, result.summary);
    }
    return this.requireUpdatedMission(mission.id);
  }

  private async executeBudgetTask(mission: Mission): Promise<Mission> {
    const task = findTask(mission, "budget");
    if (!task || task.status === "COMPLETED") return mission;
    await this.startTask(mission, task);
    const currentMission = await this.requireUpdatedMission(mission.id);
    const result = await this.costAnalysisAgent.run({
      mission: currentMission,
      objective: "Build a budget only from provider-backed prices.",
    });
    if (result.status === "COMPLETED" && result.data) {
      await this.missionService.addCostEstimates(mission.id, result.data);
      await this.completeTask(mission.id, task, result.summary);
    } else {
      await this.blockTask(mission.id, task, result.summary);
    }
    return this.requireUpdatedMission(mission.id);
  }

  private async executeRecommendationTask(mission: Mission): Promise<Mission> {
    const task = findTask(mission, "recommendations");
    if (!task || task.status === "COMPLETED") return mission;
    await this.startTask(mission, task);
    const currentMission = await this.requireUpdatedMission(mission.id);
    const result = await this.recommendationAgent.run({
      mission: currentMission,
      objective: "Rank options using persisted provider evidence only.",
    });
    if (result.status === "COMPLETED" && result.data) {
      await this.missionService.addRecommendations(mission.id, result.data);
      await this.completeTask(mission.id, task, result.summary);
      await this.missionService.addTimelineEntry(mission.id, {
        taskId: task.id,
        kind: "RECOMMENDATION_GENERATED",
        message: result.summary,
      });
    } else {
      await this.blockTask(mission.id, task, result.summary);
    }
    return this.requireUpdatedMission(mission.id);
  }

  private async finalizeMission(mission: Mission): Promise<Mission> {
    const allTasksTerminal =
      mission.tasks.length > 0 &&
      mission.tasks.every((task) =>
        ["COMPLETED", "BLOCKED", "FAILED"].includes(task.status),
      );
    if (!allTasksTerminal || mission.status === "READY") return mission;

    await this.missionService.transitionMission(mission.id, "READY");
    const blockedCount = mission.tasks.filter(
      (task) => task.status === "BLOCKED",
    ).length;
    const failedCount = mission.tasks.filter(
      (task) => task.status === "FAILED",
    ).length;
    await this.missionService.addTimelineEntry(mission.id, {
      kind: "STATUS_CHANGED",
      message:
        blockedCount + failedCount === 0
          ? "Mission reached READY after all workflow tasks completed."
          : `Mission reached READY with ${blockedCount} blocked and ${failedCount} failed task(s) clearly recorded.`,
    });
    const notification = await this.notificationAgent.run({
      mission,
      objective: "Notify the operator that verified mission work is complete.",
      context: { stage: "MISSION_ANALYSIS_COMPLETED" },
    });
    if (notification.status === "COMPLETED" && notification.data) {
      await this.missionService.addNotification(mission.id, notification.data);
    }
    return this.requireUpdatedMission(mission.id);
  }

  private async startTask(mission: Mission, task: Task): Promise<void> {
    await this.missionService.updateTaskExecution(task.id, {
      status: "IN_PROGRESS",
      blockedReason: null,
      startedAt: new Date(),
      completedAt: null,
    });
    await this.missionService.addTimelineEntry(mission.id, {
      taskId: task.id,
      kind: "TASK_STARTED",
      message: `${task.title} started.`,
    });
  }

  private async completeTask(
    missionId: string,
    task: Task,
    summary: string,
  ): Promise<void> {
    await this.missionService.updateTaskExecution(task.id, {
      status: "COMPLETED",
      blockedReason: null,
      completedAt: new Date(),
    });
    await this.missionService.addTimelineEntry(missionId, {
      taskId: task.id,
      kind: "TASK_COMPLETED",
      message: `${task.title} completed. ${summary}`,
    });
  }

  private async blockTask(
    missionId: string,
    task: Task,
    reason: string,
  ): Promise<void> {
    await this.missionService.updateTaskExecution(task.id, {
      status: "BLOCKED",
      blockedReason: reason,
      completedAt: null,
    });
    await this.missionService.addTimelineEntry(missionId, {
      taskId: task.id,
      kind: "TASK_BLOCKED",
      message: `${task.title} blocked. ${reason}`,
    });
  }

  private async failTask(
    missionId: string,
    task: Task,
    reason: string,
  ): Promise<void> {
    await this.missionService.updateTaskExecution(task.id, {
      status: "FAILED",
      blockedReason: reason,
      completedAt: null,
    });
    await this.missionService.addTimelineEntry(missionId, {
      taskId: task.id,
      kind: "TASK_FAILED",
      message: `${task.title} failed. ${reason}`,
    });
  }

  private async persistEvidence(
    missionId: string,
    task: Task,
    result: ResearchData,
  ): Promise<void> {
    await this.missionService.addResearchResult(missionId, {
      providerId: result.providerId,
      capability: result.capability,
      taskKey: task.key,
      summary: result.summary,
      confidenceScore: result.confidenceScore,
      data: result.data,
      sourceUrls: result.sourceUrls,
      retrievedAt: result.retrievedAt,
    });
    await this.missionService.addTimelineEntry(missionId, {
      taskId: task.id,
      kind: "EVIDENCE_STORED",
      message: `Stored ${result.capability} evidence from ${result.providerId}.`,
    });
  }

  private async ensureMissionCreatedEvent(mission: Mission): Promise<void> {
    if (mission.timeline.some((entry) => entry.kind === "MISSION_CREATED")) {
      return;
    }
    await this.missionService.addTimelineEntry(mission.id, {
      kind: "MISSION_CREATED",
      message: `Mission created: ${mission.goal}`,
    });
  }

  private async appendTimelineOnce(
    mission: Mission,
    kind: Mission["timeline"][number]["kind"],
    message: string,
  ): Promise<void> {
    if (
      mission.timeline.some(
        (entry) => entry.kind === kind && entry.message === message,
      )
    ) {
      return;
    }
    await this.missionService.addTimelineEntry(mission.id, { kind, message });
  }

  private async requireUpdatedMission(id: string): Promise<Mission> {
    const mission = await this.missionService.getMission(id);
    if (!mission) {
      throw new Error(`Mission disappeared during orchestration: ${id}`);
    }
    return mission;
  }
}

function toCreateTask(definition: WorkflowTaskDefinition) {
  return {
    key: definition.key,
    title: definition.title,
    description: definition.description,
    capability: definition.capability,
    sequence: definition.sequence,
    required: definition.required,
  };
}

function findTask(mission: Mission, capability: string): Task | undefined {
  return mission.tasks.find((task) => task.capability === capability);
}

function bySequence(left: Task, right: Task): number {
  return left.sequence - right.sequence;
}

function humanize(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
