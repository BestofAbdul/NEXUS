import type { Mission } from "@nexus/shared";
import { MissionService } from "@nexus/mission-engine";
import { CostAnalysisAgent } from "./cost-analysis-agent";
import { MissionPlannerAgent } from "./mission-planner-agent";
import { NotificationAgent } from "./notification-agent";
import { RecommendationAgent } from "./recommendation-agent";
import { ResearchAgent } from "./research-agent";

export interface MissionOrchestrationResult {
  mission: Mission;
  currentActivity: string;
  pendingQuestions: string[];
}

type NotificationStage =
  | "MISSION_PLANNED"
  | "RESEARCH_COMPLETED"
  | "MISSION_ANALYSIS_COMPLETED";

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

    if (!findResult(workingMission, "mission-plan")) {
      const plan = await this.missionPlannerAgent.run({
        mission: workingMission,
        objective: "Interpret the goal and create a mission-specific plan.",
      });
      if (plan.status !== "COMPLETED" || !plan.data) {
        throw new Error(plan.summary);
      }

      await this.missionService.addResearchResult(workingMission.id, {
        providerId: plan.data.providerId,
        capability: plan.data.capability,
        summary: plan.data.summary,
        data: plan.data.data,
      });
      for (const task of plan.data.tasks) {
        await this.missionService.addTask(workingMission.id, task);
      }
      await this.persistNotification(workingMission, "MISSION_PLANNED");
      workingMission = await this.requireUpdatedMission(workingMission.id);
    }

    if (workingMission.type === "TRAVEL") {
      const travelResearch = await this.runTravelResearch(workingMission);
      if (travelResearch.pendingQuestions.length > 0) {
        return travelResearch;
      }
      workingMission = travelResearch.mission;
    } else if (!findResult(workingMission, "knowledge")) {
      const result = await this.researchAgent.run({
        mission: workingMission,
        objective: "Search external background relevant to the mission.",
        context: { capability: "knowledge" },
      });
      if (result.status !== "COMPLETED" || !result.data) {
        throw new Error(result.summary);
      }

      await this.missionService.addResearchResult(workingMission.id, {
        providerId: result.data.providerId,
        capability: result.data.capability,
        summary: result.data.summary,
        data: result.data.data,
      });
      await this.persistNotification(workingMission, "RESEARCH_COMPLETED");
      workingMission = await this.requireUpdatedMission(workingMission.id);
    }

    if (workingMission.recommendations.length === 0) {
      const result = await this.recommendationAgent.run({
        mission: workingMission,
        objective: `Produce ranked recommendations for ${workingMission.type}.`,
      });
      if (result.status !== "COMPLETED" || !result.data) {
        throw new Error(result.summary);
      }

      await this.missionService.addRecommendations(
        workingMission.id,
        result.data,
      );
      workingMission = await this.requireUpdatedMission(workingMission.id);
    }

    if (workingMission.costEstimates.length === 0) {
      const result = await this.costAnalysisAgent.run({
        mission: workingMission,
        objective: `Produce an informational ${workingMission.type} mission budget.`,
      });
      if (result.status !== "COMPLETED" || !result.data) {
        throw new Error(result.summary);
      }

      await this.missionService.addCostEstimates(
        workingMission.id,
        result.data,
      );
      workingMission = await this.requireUpdatedMission(workingMission.id);
    }

    await this.persistNotification(
      workingMission,
      "MISSION_ANALYSIS_COMPLETED",
    );
    workingMission = await this.requireUpdatedMission(workingMission.id);

    return {
      mission: workingMission,
      currentActivity: `${humanize(workingMission.type)} mission analysis is ready for human review.`,
      pendingQuestions: [],
    };
  }

  private async runTravelResearch(
    mission: Mission,
  ): Promise<MissionOrchestrationResult> {
    let workingMission = mission;
    const persistedWeather = workingMission.researchResults.find(
      (result) => result.capability === "weather",
    );

    if (!persistedWeather) {
      const result = await this.researchAgent.run({
        mission: workingMission,
        objective: "Research current destination weather.",
      });

      if (result.status === "NEEDS_INPUT") {
        return {
          mission: workingMission,
          currentActivity: result.summary,
          pendingQuestions: result.pendingQuestions ?? [],
        };
      }

      if (result.status === "FAILED" || !result.data) {
        throw new Error(result.summary);
      }

      await this.missionService.addResearchResult(workingMission.id, {
        providerId: result.data.providerId,
        capability: result.data.capability,
        summary: result.data.summary,
        data: result.data.data,
      });
      await this.persistNotification(workingMission, "RESEARCH_COMPLETED");
      workingMission = await this.requireUpdatedMission(workingMission.id);
    }

    if (!findResult(workingMission, "places")) {
      const result = await this.researchAgent.run({
        mission: workingMission,
        objective: "Find notable places near the travel destination.",
        context: { capability: "places" },
      });

      if (result.status === "NEEDS_INPUT") {
        return {
          mission: workingMission,
          currentActivity: result.summary,
          pendingQuestions: result.pendingQuestions ?? [],
        };
      }

      if (result.status === "COMPLETED" && result.data) {
        await this.missionService.addResearchResult(workingMission.id, {
          providerId: result.data.providerId,
          capability: result.data.capability,
          summary: result.data.summary,
          data: result.data.data,
        });
        workingMission = await this.requireUpdatedMission(workingMission.id);
      } else {
        console.warn(`Nearby places research skipped: ${result.summary}`);
      }
    }

    await this.persistNotification(workingMission, "RESEARCH_COMPLETED");
    workingMission = await this.requireUpdatedMission(workingMission.id);
    return {
      mission: workingMission,
      currentActivity: "Destination research completed.",
      pendingQuestions: [],
    };
  }

  private async persistNotification(
    mission: Mission,
    stage: NotificationStage,
  ): Promise<void> {
    const result = await this.notificationAgent.run({
      mission,
      objective: "Surface mission orchestration progress.",
      context: { stage },
    });
    if (result.status !== "COMPLETED" || !result.data) {
      throw new Error(result.summary);
    }

    await this.missionService.addNotification(mission.id, result.data);
  }

  private async requireUpdatedMission(id: string): Promise<Mission> {
    const mission = await this.missionService.getMission(id);
    if (!mission) {
      throw new Error(`Mission disappeared during orchestration: ${id}`);
    }
    return mission;
  }
}

function findResult(mission: Mission, capability: string) {
  return mission.researchResults.find(
    (result) => result.capability === capability,
  );
}

function humanize(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
