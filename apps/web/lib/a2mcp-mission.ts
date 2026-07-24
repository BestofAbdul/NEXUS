import type {
  A2MCPMissionRequest,
  A2MCPMissionResponse,
} from "@nexus/shared";
import type { MissionOrchestrationResult } from "@nexus/agents";
import {
  missionOrchestrator,
  missionService,
} from "@/lib/mission-service";

export class A2MCPMissionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function invokeA2MCPMission(
  request: A2MCPMissionRequest,
): Promise<A2MCPMissionResponse> {
  if (request.missionId) {
    return resumeMission(request);
  }

  return createMission(request);
}

async function createMission(
  request: A2MCPMissionRequest,
): Promise<A2MCPMissionResponse> {
  const draft = await missionService.createMission({
    title: titleFromGoal(request.goal),
    type: request.missionType ?? "CUSTOM",
    goal: request.goal,
    setupAnswers: request.context,
  });
  const mission = await missionService.transitionMission(draft.id, "ACTIVE");
  return toResponse(await missionOrchestrator.run(mission));
}

async function resumeMission(
  request: A2MCPMissionRequest,
): Promise<A2MCPMissionResponse> {
  const existing = await missionService.getMission(request.missionId!);
  if (!existing) {
    throw new A2MCPMissionError(
      "MISSION_NOT_FOUND",
      `Mission not found: ${request.missionId}`,
      404,
    );
  }

  const userMessage = request.message?.trim();
  const conversationMessage = userMessage
    ? await missionService.addConversationMessage(existing.id, {
        role: "USER",
        content: userMessage,
      })
    : undefined;
  const mergedContext = {
    ...existing.setupAnswers,
    ...request.context,
    ...(request.action
      ? {
          explorationRequest: request.action.query?.trim() || "Explore more",
          explorationRecommendationId: request.action.recommendationId,
        }
      : {}),
  };
  const shouldUpdateGoal =
    Boolean(request.context || request.action) && request.goal !== existing.goal;
  const contextChanged =
    JSON.stringify(mergedContext) !== JSON.stringify(existing.setupAnswers) ||
    shouldUpdateGoal;
  let mission = contextChanged
    ? await missionService.updateMission(existing.id, {
        goal: shouldUpdateGoal ? request.goal : existing.goal,
        title: shouldUpdateGoal
          ? titleFromGoal(request.goal)
          : existing.title,
        setupAnswers: mergedContext,
      })
    : existing;

  if (contextChanged) {
    await missionService.resetMissionOutputs(existing.id);
    mission = (await missionService.getMission(existing.id))!;
    if (mission.status === "READY") {
      mission = await missionService.transitionMission(mission.id, "ACTIVE");
    }
  }

  if (mission.status === "DRAFT") {
    mission = await missionService.transitionMission(mission.id, "ACTIVE");
  } else if (
    mission.status === "READY" &&
    mission.tasks.some(
      (task) => task.status === "BLOCKED" || task.status === "FAILED",
    )
  ) {
    mission = await missionService.transitionMission(mission.id, "ACTIVE");
  }

  return toResponse(
    await missionOrchestrator.run(mission, {
      conversationMessage: userMessage,
      conversationMessageId: conversationMessage?.id,
    }),
  );
}

function toResponse(
  orchestration: MissionOrchestrationResult,
): A2MCPMissionResponse {
  const { mission } = orchestration;
  const evidenceResults = mission.researchResults.filter(
    (result) => result.capability !== "mission-plan",
  );
  const averageConfidence =
    evidenceResults.length > 0
      ? roundConfidence(
          evidenceResults.reduce(
            (total, result) => total + result.confidenceScore,
            0,
          ) / evidenceResults.length,
        )
      : null;

  return {
    accepted: true,
    missionId: mission.id,
    missionType: mission.type,
    status: mission.status,
    progress: mission.progress,
    currentActivity: orchestration.currentActivity,
    pendingQuestions: orchestration.pendingQuestions,
    results: mission.researchResults.map((result) => ({
      ...result,
      retrievedAt: result.retrievedAt.toISOString(),
      createdAt: result.createdAt.toISOString(),
    })),
    recommendations: mission.recommendations.map((recommendation) => ({
      ...recommendation,
      createdAt: recommendation.createdAt.toISOString(),
    })),
    costBreakdown: {
      currency: mission.costEstimates[0]?.currency ?? "USD",
      lineItems: mission.costEstimates.map((estimate) => ({
        ...estimate,
        createdAt: estimate.createdAt.toISOString(),
      })),
      total: mission.costEstimates.reduce(
        (total, estimate) => total + estimate.amount,
        0,
      ),
      disclaimer:
        "Informational estimate only. NEXUS never pays, books, or accesses financial accounts.",
    },
    tasks: mission.tasks.map((task) => ({
      ...task,
      dueAt: task.dueAt?.toISOString() ?? null,
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
    notifications: mission.notifications.map((notification) => ({
      ...notification,
      createdAt: notification.createdAt.toISOString(),
    })),
    conversation: mission.conversation.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    })),
    timeline: mission.timeline.map((entry) => ({
      ...entry,
      occurredAt: entry.occurredAt.toISOString(),
    })),
    executionSummary: {
      completedTasks: mission.tasks
        .filter((task) => task.status === "COMPLETED")
        .map(taskSummary),
      blockedTasks: mission.tasks
        .filter((task) => task.status === "BLOCKED")
        .map((task) => ({
          ...taskSummary(task),
          reason: task.blockedReason ?? "Capability is blocked.",
        })),
      failedTasks: mission.tasks
        .filter((task) => task.status === "FAILED")
        .map((task) => ({
          ...taskSummary(task),
          reason: task.blockedReason ?? "Capability execution failed.",
        })),
      evidenceCollected: evidenceResults.map((result) => ({
        capability: result.capability,
        providerId: result.providerId,
        summary: result.summary,
        confidenceScore: result.confidenceScore,
        sourceUrls: result.sourceUrls,
      })),
      averageConfidence,
      pendingActions: pendingActions(mission, orchestration.pendingQuestions),
    },
  };
}

function taskSummary(task: {
  key: string;
  title: string;
  capability: string;
}) {
  return {
    key: task.key,
    title: task.title,
    capability: task.capability,
  };
}

function pendingActions(
  mission: MissionOrchestrationResult["mission"],
  pendingQuestions: string[],
): string[] {
  const actions = [...pendingQuestions];
  for (const task of mission.tasks) {
    if (task.status !== "BLOCKED" && task.status !== "FAILED") continue;
    const reason = task.blockedReason ?? "Capability execution is unavailable.";
    if (reason === "No flight provider configured") {
      actions.push(
        "Configure a provider with the flights capability to unlock live flight schedules and fares.",
      );
    } else if (reason === "No airport provider configured") {
      actions.push(
        "Configure a provider with the airports capability to unlock route and airport resolution.",
      );
    } else if (reason === "No hotel provider configured") {
      actions.push(
        "Configure a provider with the hotels capability to unlock live accommodation offers.",
      );
    } else if (/No MCP provider|unconfigured|not configured/i.test(reason)) {
      actions.push(
        `Configure an MCP provider for the ${task.capability} capability.`,
      );
    } else {
      actions.push(`${task.title}: ${reason}`);
    }
  }
  return [...new Set(actions)];
}

function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}

function titleFromGoal(goal: string): string {
  return goal.length <= 80 ? goal : `${goal.slice(0, 77)}...`;
}
