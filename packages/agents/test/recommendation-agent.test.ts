import assert from "node:assert/strict";
import test from "node:test";
import type { Mission, MissionResearchResult } from "@nexus/shared";
import { RecommendationAgent } from "../src/recommendation-agent";

test("synthesizes at most three distinct on-topic evidence recommendations", async () => {
  const rawRelevantExcerpt =
    "Benue travel guidance for visitors arriving from China, including current entry considerations.";
  const mission = createMission([
    evidenceResult("visa", [
      evidenceItem(
        "Benue entry guidance",
        rawRelevantExcerpt,
        0.94,
        "https://example.gov/benue-entry",
      ),
      evidenceItem(
        "Duplicate Benue entry guidance",
        `${rawRelevantExcerpt} Additional duplicate wording.`,
        0.93,
        "https://example.gov/benue-entry-copy",
      ),
      evidenceItem(
        "Nigeria travel information for Chinese visitors",
        "Official Nigeria information relevant to travelers from China visiting Benue.",
        0.9,
        "https://immigration.gov.ng/china-benue",
      ),
      evidenceItem(
        "China TypeScript stack trace question",
        "How to fix a TypeScript error in a Next.js application from China.",
        0.99,
        "https://stackoverflow.com/questions/123",
      ),
    ]),
  ]);

  const result = await new RecommendationAgent().run({
    mission,
    objective: "Recommend only evidence-backed next actions.",
  });

  assert.equal(result.status, "COMPLETED");
  assert.ok(result.data);
  assert.ok(result.data.length > 0 && result.data.length <= 3);
  assert.ok(
    result.data.every(
      (recommendation) => recommendation.summary !== rawRelevantExcerpt,
    ),
  );
  assert.ok(
    result.data.every(
      (recommendation) =>
        !/typescript|next\.js|stackoverflow/i.test(
          `${recommendation.title} ${recommendation.summary} ${recommendation.rationale}`,
        ),
    ),
  );
  assert.equal(
    new Set(result.data.map((recommendation) => recommendation.title)).size,
    result.data.length,
  );
});

function createMission(researchResults: MissionResearchResult[]): Mission {
  const now = new Date("2026-07-24T00:00:00.000Z");
  return {
    id: "mission-recommendation-test",
    title: "Travel from China to Benue",
    type: "TRAVEL",
    status: "ACTIVE",
    goal: "Plan a trip from China to Benue",
    setupAnswers: {
      origin: "china",
      destination: "benue",
      departureDate: "2026-08-10",
    },
    progress: 0,
    tasks: [],
    researchResults,
    recommendations: [],
    costEstimates: [],
    notifications: [],
    conversation: [],
    timeline: [],
    createdAt: now,
    updatedAt: now,
  };
}

function evidenceResult(
  capability: string,
  items: Array<Record<string, unknown>>,
): MissionResearchResult {
  const now = new Date("2026-07-24T00:00:00.000Z");
  return {
    id: `result-${capability}`,
    missionId: "mission-recommendation-test",
    providerId: "tavily-evidence-search",
    capability,
    taskKey: `research-${capability}`,
    summary: "Evidence summary",
    confidenceScore: 0.9,
    data: { source: "Tavily", items },
    sourceUrls: items.map((item) => String(item.url)),
    retrievedAt: now,
    createdAt: now,
  };
}

function evidenceItem(
  title: string,
  excerpt: string,
  score: number,
  url: string,
): Record<string, unknown> {
  return { title, excerpt, score, url };
}
