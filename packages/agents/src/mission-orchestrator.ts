import type {
  Mission,
  Task,
  WorkflowTaskDefinition,
} from "@nexus/shared";
import { MissionService } from "@nexus/mission-engine";
import { CostAnalysisAgent } from "./cost-analysis-agent";
import {
  ConversationAgent,
  type ConversationDecision,
} from "./conversation-agent";
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

export interface MissionOrchestrationOptions {
  conversationMessage?: string;
  conversationMessageId?: string;
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
    private readonly conversationAgent: ConversationAgent,
  ) {}

  async run(
    mission: Mission,
    options: MissionOrchestrationOptions = {},
  ): Promise<MissionOrchestrationResult> {
    let workingMission = mission;
    let setupConversationActivity: string | undefined;
    let conversationDecision: ConversationDecision | undefined;
    await this.ensureMissionCreatedEvent(workingMission);

    let pendingQuestions = getBlockingQuestions(workingMission);
    if (options.conversationMessage) {
      const handled = await this.prepareConversation(
        workingMission,
        options.conversationMessage,
        pendingQuestions,
      );
      workingMission = handled.mission;
      conversationDecision = handled.decision;
      if (handled.decision.kind !== "RESEARCH") {
        setupConversationActivity = handled.decision.reply;
      }
      pendingQuestions = getBlockingQuestions(workingMission);
    }
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
          setupConversationActivity ??
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
    const conversationActivity =
      options.conversationMessage &&
      conversationDecision?.kind === "RESEARCH"
      ? await this.executeConversation(
          workingMission,
          options.conversationMessage,
          options.conversationMessageId,
          conversationDecision,
        )
      : undefined;
    workingMission = await this.requireUpdatedMission(workingMission.id);
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
        conversationActivity ??
        setupConversationActivity ??
        (workingMission.status === "READY"
          ? blockedCount + failedCount === 0
            ? `${humanize(workingMission.type)} mission is ready from verified evidence.`
            : `${humanize(workingMission.type)} mission is ready with ${completedCount} completed, ${blockedCount} blocked, and ${failedCount} failed task(s).`
          : next?.blockedReason
            ? `${next.title}: ${next.blockedReason}`
            : next
              ? `${next.title} is waiting to run.`
              : "Mission execution is active."),
      pendingQuestions: [],
    };
  }

  private async prepareConversation(
    mission: Mission,
    message: string,
    pendingQuestions: string[],
  ): Promise<{ mission: Mission; decision: ConversationDecision }> {
    const result = await this.conversationAgent.run({
      mission,
      objective: "Respond to the user's in-mission message.",
      context: { message, pendingQuestions },
    });
    const decision = result.data ?? {
      kind: "ASK",
      reply: result.summary,
      researchQueries: [],
      deepResearch: false,
      contextUpdates: {},
    };
    let updatedMission = mission;
    if (decision.kind === "UPDATE_CONTEXT") {
      updatedMission = await this.missionService.updateMission(mission.id, {
        setupAnswers: {
          ...mission.setupAnswers,
          ...decision.contextUpdates,
        },
      });
      if (
        mission.tasks.length > 0 ||
        mission.researchResults.length > 0 ||
        mission.recommendations.length > 0 ||
        mission.costEstimates.length > 0
      ) {
        await this.missionService.resetMissionOutputs(mission.id);
        updatedMission = await this.requireUpdatedMission(mission.id);
      }
      if (updatedMission.status === "READY") {
        updatedMission = await this.missionService.transitionMission(
          mission.id,
          "ACTIVE",
        );
      }
    }
    if (decision.kind !== "RESEARCH") {
      await this.missionService.addConversationMessage(mission.id, {
        role: "AGENT",
        content: decision.reply,
      });
    }
    return {
      mission: await this.requireUpdatedMission(updatedMission.id),
      decision,
    };
  }

  private async executeConversation(
    mission: Mission,
    message: string,
    messageId?: string,
    preparedDecision?: ConversationDecision,
  ): Promise<string> {
    const decisionResult = preparedDecision
      ? undefined
      : await this.conversationAgent.run({
          mission,
          objective: "Decide whether to ask for input or research the follow-up.",
          context: { message, pendingQuestions: [] },
        });
    const decision = preparedDecision ?? decisionResult?.data;
    if (!decision) {
      await this.missionService.addConversationMessage(mission.id, {
        role: "AGENT",
        content: decisionResult?.summary ?? "I couldn't process that follow-up.",
      });
      return decisionResult?.summary ?? "I couldn't process that follow-up.";
    }
    if (decision.kind === "ASK") {
      await this.missionService.addConversationMessage(mission.id, {
        role: "AGENT",
        content: decision.reply,
      });
      return decision.reply;
    }

    const currentMission = await this.requireUpdatedMission(mission.id);
    const research = await this.researchAgent.run({
      mission: currentMission,
      objective: "Research and verify the user's conversation follow-up.",
      context: {
        capability: "knowledge",
        queries: decision.researchQueries,
        deepResearch: decision.deepResearch,
      },
    });
    if (research.status !== "COMPLETED" || !research.data) {
      const reply =
        `I couldn't verify that follow-up yet. ${research.summary}`.trim();
      await this.missionService.addConversationMessage(mission.id, {
        role: "AGENT",
        content: reply,
      });
      return reply;
    }

    await this.missionService.addResearchResult(mission.id, {
      providerId: research.data.providerId,
      capability: "conversation-research",
      taskKey: `conversation-${messageId ?? Date.now()}`,
      summary: research.data.summary,
      confidenceScore: research.data.confidenceScore,
      data: {
        ...research.data.data,
        conversationMessage: message,
        originalCapability: research.data.capability,
      },
      sourceUrls: research.data.sourceUrls,
      retrievedAt: research.data.retrievedAt,
    });
    const reply = conversationReply(research.data);
    await this.missionService.addConversationMessage(mission.id, {
      role: "AGENT",
      content: reply,
    });
    await this.missionService.addTimelineEntry(mission.id, {
      kind: "EVIDENCE_STORED",
      message: `Conversation follow-up researched through ${research.data.providerId}.`,
    });
    return "Conversation follow-up researched and persisted with source evidence.";
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

function conversationReply(result: ResearchData): string {
  const sourceCount = result.sourceUrls.length;
  return [
    result.summary,
    sourceCount > 0
      ? `I verified this against ${sourceCount} source${sourceCount === 1 ? "" : "s"} and stored them with the mission.`
      : "No source URL was returned, so treat this as incomplete evidence.",
    `Confidence: ${Math.round(result.confidenceScore * 100)}%.`,
  ].join(" ");
}
