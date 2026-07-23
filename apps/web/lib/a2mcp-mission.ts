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
  }

  return toResponse(await missionOrchestrator.run(mission));
}

function toResponse(
  orchestration: MissionOrchestrationResult,
): A2MCPMissionResponse {
  const { mission } = orchestration;

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
    timeline: mission.timeline.map((entry) => ({
      ...entry,
      occurredAt: entry.occurredAt.toISOString(),
    })),
  };
}

function titleFromGoal(goal: string): string {
  return goal.length <= 80 ? goal : `${goal.slice(0, 77)}...`;
}
