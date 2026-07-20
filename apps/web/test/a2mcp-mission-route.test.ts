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
    goal: "Plan a five-day trip to Tokyo",
    missionType: "TRAVEL",
    context: { destination: "Tokyo" },
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.accepted, true);
  assert.equal(body.status, "ACTIVE");
  assert.equal(body.progress, 0);
  assert.equal(body.currentActivity, "Mission created, awaiting orchestration");
  assert.deepEqual(body.pendingQuestions, []);
  assert.equal(typeof body.missionId, "string");

  createdMissionIds.add(body.missionId);
  const persisted = await prisma.mission.findUnique({
    where: { id: body.missionId },
  });

  assert.ok(persisted);
  assert.equal(persisted.status, "ACTIVE");
  assert.equal(persisted.goal, "Plan a five-day trip to Tokyo");
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

  assert.equal(createResponse.status, 201);
  assert.equal(resumeResponse.status, 200);
  assert.equal(resumed.accepted, true);
  assert.equal(resumed.missionId, created.missionId);
  assert.equal(resumed.status, "ACTIVE");
  assert.equal(resumed.currentActivity, "Mission resumed, awaiting orchestration");
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

function invoke(body: Record<string, unknown>): Promise<Response> {
  return POST(
    new Request("http://localhost/api/a2mcp/mission", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}
