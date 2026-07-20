import type { Mission } from "@nexus/shared";
import { MissionService } from "@nexus/mission-engine";
import { ResearchAgent } from "./research-agent";

export interface MissionOrchestrationResult {
  mission: Mission;
  currentActivity: string;
  pendingQuestions: string[];
}

export class MissionOrchestrator {
  constructor(
    private readonly missionService: MissionService,
    private readonly researchAgent: ResearchAgent,
  ) {}

  async run(mission: Mission): Promise<MissionOrchestrationResult> {
    if (mission.type !== "TRAVEL") {
      return {
        mission,
        currentActivity:
          "Mission active; no Phase 3 research capability applies.",
        pendingQuestions: [],
      };
    }

    const persistedWeather = [...mission.researchResults]
      .reverse()
      .find((result) => result.capability === "weather");
    if (persistedWeather) {
      return {
        mission,
        currentActivity: persistedWeather.summary,
        pendingQuestions: [],
      };
    }

    const result = await this.researchAgent.run({
      mission,
      objective: "Research current destination weather.",
    });

    if (result.status === "NEEDS_INPUT") {
      return {
        mission,
        currentActivity: result.summary,
        pendingQuestions: result.pendingQuestions ?? [],
      };
    }

    if (result.status === "FAILED" || !result.data) {
      throw new Error(result.summary);
    }

    await this.missionService.addResearchResult(mission.id, {
      providerId: result.data.providerId,
      capability: result.data.capability,
      summary: result.data.summary,
      data: result.data.data,
    });

    const updatedMission = await this.missionService.getMission(mission.id);
    if (!updatedMission) {
      throw new Error(`Mission disappeared during orchestration: ${mission.id}`);
    }

    return {
      mission: updatedMission,
      currentActivity: result.data.summary,
      pendingQuestions: [],
    };
  }
}
