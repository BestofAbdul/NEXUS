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
    goal: "Land a senior platform engineering role",
    missionType: "NEW_JOB",
    context: {
      targetRole: "Senior Platform Engineer",
      industry: "Fintech",
      preferences: "Remote-first and strong infrastructure ownership",
    },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.accepted, true);
  assert.equal(body.status, "ACTIVE");
  assert.equal(body.progress, 0);
  assert.equal(
    body.currentActivity,
    "New Job mission analysis is ready for human review.",
  );
  assert.deepEqual(body.pendingQuestions, []);
  assert.equal(body.results.length, 2);
  assert.equal(body.results[0].capability, "mission-plan");
  assert.match(body.results[0].summary, /Senior Platform Engineer/);
  assert.match(body.results[0].summary, /Remote-first/);
  assert.equal(body.recommendations.length, 3);
  assert.match(body.recommendations[0].summary, /Senior Platform Engineer/);
  assert.equal(body.tasks.length, 3);
  assert.ok(body.costBreakdown.total > 0);
  assert.equal(body.notifications.length, 3);
  assert.equal(typeof body.missionId, "string");

  createdMissionIds.add(body.missionId);
  const persisted = await prisma.mission.findUnique({
    where: { id: body.missionId },
  });

  assert.ok(persisted);
  assert.equal(persisted.status, "ACTIVE");
  assert.equal(persisted.goal, "Land a senior platform engineering role");
});

test("resumes an existing mission without creating a duplicate", async () => {
  const beforeCount = await prisma.mission.count();
  const createResponse = await invoke({
    goal: "Build a relocation plan from Nigeria to Canada",
    missionType: "RELOCATE",
    context: {
      destination: "Canada",
      movingFrom: "Nigeria",
      priorities: "Affordable housing, technology jobs, and public transport",
    },
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
    "Relocate mission analysis is ready for human review.",
  );
  assert.equal(resumed.results.length, 2);
  assert.equal(resumed.recommendations.length, 3);
  assert.equal(resumed.tasks.length, 3);
  assert.match(JSON.stringify(resumed.recommendations), /Canada/);
  assert.match(JSON.stringify(resumed.recommendations), /Affordable housing/);
  assert.equal(afterCreateCount, beforeCount + 1);
  assert.equal(afterResumeCount, afterCreateCount);
  assert.equal(
    await prisma.missionResearchResult.count({
      where: { missionId: created.missionId },
    }),
    2,
  );
  assert.equal(
    await prisma.task.count({ where: { missionId: created.missionId } }),
    3,
  );
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
    "Travel mission analysis is ready for human review.",
  );
  assert.equal(created.results.length, 3);
  assertWeatherResult(
    created.results.find(
      (result: Record<string, any>) => result.capability === "weather",
    ),
  );
  assertPlacesResult(
    created.results.find(
      (result: Record<string, any>) => result.capability === "places",
    ),
  );
  assert.equal(created.recommendations.length, 3);
  assert.deepEqual(
    created.recommendations.map((item: Record<string, any>) => item.rank),
    [1, 2, 3],
  );
  assert.equal(created.costBreakdown.currency, "USD");
  assert.equal(created.costBreakdown.lineItems.length, 4);
  assert.equal(created.costBreakdown.total, 575);
  assert.match(created.costBreakdown.disclaimer, /never pays, books/i);
  assert.equal(created.tasks.length, 3);
  assert.equal(created.notifications.length, 3);

  createdMissionIds.add(created.missionId);
  const firstPersistedCount = await prisma.missionResearchResult.count({
    where: { missionId: created.missionId },
  });
  assert.equal(firstPersistedCount, 3);

  const resumeResponse = await invoke({
    goal: "Continue the Tokyo travel mission",
    missionId: created.missionId,
  });
  const resumed = await resumeResponse.json();

  assert.equal(resumeResponse.status, 200);
  assert.equal(resumed.missionId, created.missionId);
  assert.equal(
    resumed.currentActivity,
    "Travel mission analysis is ready for human review.",
  );
  assert.equal(resumed.results.length, 3);
  assertWeatherResult(
    resumed.results.find(
      (result: Record<string, any>) => result.capability === "weather",
    ),
  );
  assertPlacesResult(
    resumed.results.find(
      (result: Record<string, any>) => result.capability === "places",
    ),
  );
  assert.deepEqual(resumed.recommendations, created.recommendations);
  assert.deepEqual(resumed.costBreakdown, created.costBreakdown);
  assert.deepEqual(resumed.notifications, created.notifications);

  const secondPersistedCount = await prisma.missionResearchResult.count({
    where: { missionId: created.missionId },
  });
  assert.equal(secondPersistedCount, 3);
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
    3,
  );
});

test("builds a study-abroad mission from the caller's subject and constraints", async () => {
  const response = await invoke({
    goal: "Find a practical master's program that can lead to data work",
    missionType: "STUDY_ABROAD",
    context: {
      destination: "United Kingdom",
      subject: "Data Science",
      studyLevel: "Master's",
      intake: "September 2027",
      preferences:
        "Scholarships, practical coursework, and post-study work options",
    },
  });
  const body = await response.json();
  createdMissionIds.add(body.missionId);

  assert.equal(response.status, 200);
  assert.equal(
    body.currentActivity,
    "Study Abroad mission analysis is ready for human review.",
  );
  assert.equal(body.results.length, 2);
  assert.match(body.results[0].summary, /Data Science/);
  assert.match(body.results[0].summary, /Scholarships/);
  assert.equal(body.recommendations.length, 3);
  assert.match(body.recommendations[0].summary, /Data Science/);
  assert.match(body.recommendations[1].summary, /September 2027/);
  assert.equal(body.tasks.length, 3);
  assert.ok(body.costBreakdown.total > 0);
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

function assertWeatherResult(result: Record<string, any> | undefined): void {
  assert.ok(result);
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

function assertPlacesResult(result: Record<string, any> | undefined): void {
  assert.ok(result);
  assert.equal(result.providerId, "openstreetmap-nearby-places");
  assert.equal(result.capability, "places");
  assert.equal(result.data.source, "OpenStreetMap");
  assert.equal(result.data.location, "Tokyo");
  assert.ok(result.data.places.length > 0);
  assert.equal(typeof result.data.places[0].title, "string");
  assert.equal(result.data.mcp.protocol, "MCP");
  assert.equal(result.data.mcp.serverName, "nexus-openstreetmap-places");
  assert.equal(result.data.mcp.tool, "find_nearby_places");
}
