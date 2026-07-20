import type { Mission } from "@nexus/shared";
import { MissionService } from "@nexus/mission-engine";
import { CostAnalysisAgent } from "./cost-analysis-agent";
import { NotificationAgent } from "./notification-agent";
import { RecommendationAgent } from "./recommendation-agent";
import { ResearchAgent } from "./research-agent";

export interface MissionOrchestrationResult {
  mission: Mission;
  currentActivity: string;
  pendingQuestions: string[];
}

type NotificationStage =
  | "RESEARCH_COMPLETED"
  | "MISSION_ANALYSIS_COMPLETED";

export class MissionOrchestrator {
  constructor(
    private readonly missionService: MissionService,
    private readonly researchAgent: ResearchAgent,
    private readonly recommendationAgent: RecommendationAgent,
    private readonly costAnalysisAgent: CostAnalysisAgent,
    private readonly notificationAgent: NotificationAgent,
  ) {}

  async run(mission: Mission): Promise<MissionOrchestrationResult> {
    if (mission.type !== "TRAVEL") {
      return {
        mission,
        currentActivity:
          "Mission active; the Phase 4 agent flow currently supports Travel missions.",
        pendingQuestions: [],
      };
    }

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

    if (workingMission.recommendations.length === 0) {
      const result = await this.recommendationAgent.run({
        mission: workingMission,
        objective: "Produce ranked, actionable travel recommendations.",
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
        objective: "Produce an informational mission budget.",
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
      currentActivity:
        "Research, recommendations, and cost analysis are ready for human review.",
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
