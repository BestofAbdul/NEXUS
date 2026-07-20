import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { POST } from "../app/api/a2mcp/mission/route.js";

const prisma = new PrismaClient();
const createdMissionIds = new Set<string>();

test.after(async () => {
  if (createdMissionIds.size > 0) {
    await prisma.mission.deleteMany({
      where: { id: { in: [...createdMissionIds] } },
    });
  }

  await prisma.$disconnect();
});

test("creates and persists an active mission", async () => {
  const response = await invoke({
    goal: "Prepare for a senior engineering job search",
    missionType: "NEW_JOB",
    context: { industry: "Software" },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.accepted, true);
  assert.equal(body.status, "ACTIVE");
  assert.equal(body.progress, 0);
  assert.equal(
    body.currentActivity,
    "Mission active; the Phase 4 agent flow currently supports Travel missions.",
  );
  assert.deepEqual(body.pendingQuestions, []);
  assert.deepEqual(body.results, []);
  assert.deepEqual(body.recommendations, []);
  assert.equal(body.costBreakdown.total, 0);
  assert.deepEqual(body.notifications, []);
  assert.equal(typeof body.missionId, "string");

  createdMissionIds.add(body.missionId);
  const persisted = await prisma.mission.findUnique({
    where: { id: body.missionId },
  });

  assert.ok(persisted);
  assert.equal(persisted.status, "ACTIVE");
  assert.equal(persisted.goal, "Prepare for a senior engineering job search");
});

test("resumes an existing mission without creating a duplicate", async () => {
  const beforeCount = await prisma.mission.count();
  const createResponse = await invoke({
    goal: "Research relocation options for Canada",
    missionType: "RELOCATE",
  });
  const created = await createResponse.json();
  createdMissionIds.add(created.missionId);

  const afterCreateCount = await prisma.mission.count();
  const resumeResponse = await invoke({
    goal: "Continue researching relocation options for Canada",
    missionId: created.missionId,
  });
  const resumed = await resumeResponse.json();
  const afterResumeCount = await prisma.mission.count();

  assert.equal(createResponse.status, 200);
  assert.equal(resumeResponse.status, 200);
  assert.equal(resumed.accepted, true);
  assert.equal(resumed.missionId, created.missionId);
  assert.equal(resumed.status, "ACTIVE");
  assert.equal(
    resumed.currentActivity,
    "Mission active; the Phase 4 agent flow currently supports Travel missions.",
  );
  assert.deepEqual(resumed.results, []);
  assert.equal(afterCreateCount, beforeCount + 1);
  assert.equal(afterResumeCount, afterCreateCount);
});

test("returns clean errors for invalid requests", async () => {
  const missingGoalResponse = await invoke({ missionType: "TRAVEL" });
  const missingGoal = await missingGoalResponse.json();

  assert.equal(missingGoalResponse.status, 400);
  assert.deepEqual(missingGoal, {
    error: {
      code: "INVALID_GOAL",
      message: "goal is required and must be a non-empty string.",
    },
  });

  const invalidTypeResponse = await invoke({
    goal: "Plan something",
    missionType: "NOT_A_MISSION_TYPE",
  });
  const invalidType = await invalidTypeResponse.json();

  assert.equal(invalidTypeResponse.status, 400);
  assert.equal(invalidType.error.code, "INVALID_MISSION_TYPE");
});

test("runs real weather research through MCP and persists it across resume", async () => {
  const createResponse = await invoke({
    goal: "Plan a five-day trip to Tokyo",
    missionType: "TRAVEL",
  });
  const created = await createResponse.json();

  assert.equal(createResponse.status, 200);
  assert.equal(created.accepted, true);
  assert.equal(created.status, "ACTIVE");
  assert.equal(
    created.currentActivity,
    "Research, recommendations, and cost analysis are ready for human review.",
  );
  assert.equal(created.results.length, 1);
  assertWeatherResult(created.results[0]);
  assert.equal(created.recommendations.length, 3);
  assert.deepEqual(
    created.recommendations.map((item: Record<string, any>) => item.rank),
    [1, 2, 3],
  );
  assert.equal(created.costBreakdown.currency, "USD");
  assert.equal(created.costBreakdown.lineItems.length, 4);
  assert.equal(created.costBreakdown.total, 465);
  assert.match(created.costBreakdown.disclaimer, /never pays, books/i);
  assert.equal(created.notifications.length, 2);

  createdMissionIds.add(created.missionId);
  const firstPersistedCount = await prisma.missionResearchResult.count({
    where: { missionId: created.missionId },
  });
  assert.equal(firstPersistedCount, 1);

  const resumeResponse = await invoke({
    goal: "Continue the Tokyo travel mission",
    missionId: created.missionId,
  });
  const resumed = await resumeResponse.json();

  assert.equal(resumeResponse.status, 200);
  assert.equal(resumed.missionId, created.missionId);
  assert.equal(
    resumed.currentActivity,
    "Research, recommendations, and cost analysis are ready for human review.",
  );
  assert.equal(resumed.results.length, 1);
  assertWeatherResult(resumed.results[0]);
  assert.deepEqual(resumed.recommendations, created.recommendations);
  assert.deepEqual(resumed.costBreakdown, created.costBreakdown);
  assert.deepEqual(resumed.notifications, created.notifications);

  const secondPersistedCount = await prisma.missionResearchResult.count({
    where: { missionId: created.missionId },
  });
  assert.equal(secondPersistedCount, 1);
  assert.equal(
    await prisma.recommendation.count({
      where: { missionId: created.missionId },
    }),
    3,
  );
  assert.equal(
    await prisma.costEstimate.count({
      where: { missionId: created.missionId },
    }),
    4,
  );
  assert.equal(
    await prisma.missionNotification.count({
      where: { missionId: created.missionId },
    }),
    2,
  );
});

function invoke(body: Record<string, unknown>): Promise<Response> {
  return POST(
    new Request("http://localhost/api/a2mcp/mission", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function assertWeatherResult(result: Record<string, any>): void {
  assert.equal(result.providerId, "open-meteo-weather");
  assert.equal(result.capability, "weather");
  assert.equal(result.data.source, "Open-Meteo");
  assert.equal(result.data.location, "Tokyo");
  assert.equal(result.data.country, "Japan");
  assert.equal(typeof result.data.temperatureC, "number");
  assert.equal(typeof result.data.observedAt, "string");
  assert.equal(result.data.mcp.protocol, "MCP");
  assert.equal(result.data.mcp.transport, "in-memory");
  assert.equal(result.data.mcp.serverName, "nexus-open-meteo-weather");
  assert.equal(result.data.mcp.tool, "get_current_weather");
}
