import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { POST } from "../app/api/a2mcp/mission/route.js";

const prisma = new PrismaClient();
const createdMissionIds = new Set<string>();
const originalFetch = globalThis.fetch;

test.before(() => {
  globalThis.fetch = mockProviderFetch;
});

test.after(async () => {
  if (createdMissionIds.size > 0) {
    await prisma.mission.deleteMany({
      where: { id: { in: [...createdMissionIds] } },
    });
  }
  globalThis.fetch = originalFetch;
  await prisma.$disconnect();
});

test("creates an evidence workflow instead of assumed job advice", async () => {
  const response = await invoke({
    goal: "Land a senior platform engineering role",
    missionType: "NEW_JOB",
    context: {
      targetRole: "Senior Platform Engineer",
      location: "Remote Europe",
      industry: "Fintech",
      preferences: "Remote-first and infrastructure ownership",
    },
  });
  const body = await response.json();
  createdMissionIds.add(body.missionId);

  assert.equal(response.status, 200);
  assert.equal(body.accepted, true);
  assert.equal(body.missionType, "NEW_JOB");
  assert.equal(body.status, "ACTIVE");
  assert.equal(body.progress, 0);
  assert.deepEqual(body.pendingQuestions, []);
  assert.equal(body.results.length, 1);
  assert.equal(body.results[0].capability, "mission-plan");
  assert.equal(body.tasks.length, 5);
  assert.ok(body.tasks.every((task: any) => task.capability));
  assert.ok(body.tasks.some((task: any) => task.status === "BLOCKED"));
  assert.match(body.currentActivity, /TAVILY_API_KEY|provider/i);
  assert.equal(body.recommendations.length, 0);
  assert.equal(body.costBreakdown.total, 0);
  assert.ok(body.timeline.some((entry: any) => entry.kind === "WORKFLOW_CREATED"));
  assert.ok(body.timeline.some((entry: any) => entry.kind === "TASK_BLOCKED"));
});

test("resumes a blocked workflow without duplicating mission, tasks, or evidence", async () => {
  const beforeCount = await prisma.mission.count();
  const createResponse = await invoke({
    goal: "Build a relocation plan from Nigeria to Canada",
    missionType: "RELOCATE",
    context: {
      movingFrom: "Nigeria",
      destination: "Toronto, Canada",
      workStatus: "Software engineer seeking work",
      priorities: "Affordable housing and public transport",
    },
  });
  const created = await createResponse.json();
  createdMissionIds.add(created.missionId);
  const afterCreateCount = await prisma.mission.count();
  const firstTaskCount = await prisma.task.count({
    where: { missionId: created.missionId },
  });
  const firstEvidenceCount = await prisma.missionResearchResult.count({
    where: { missionId: created.missionId },
  });

  const resumeResponse = await invoke({
    goal: "Continue this relocation mission",
    missionId: created.missionId,
  });
  const resumed = await resumeResponse.json();

  assert.equal(resumeResponse.status, 200);
  assert.equal(resumed.missionId, created.missionId);
  assert.equal(afterCreateCount, beforeCount + 1);
  assert.equal(await prisma.mission.count(), afterCreateCount);
  assert.equal(
    await prisma.task.count({ where: { missionId: created.missionId } }),
    firstTaskCount,
  );
  assert.equal(
    await prisma.missionResearchResult.count({
      where: { missionId: created.missionId },
    }),
    firstEvidenceCount,
  );
  assert.equal(resumed.tasks.length, 10);
  assert.ok(resumed.timeline.length > created.timeline.length);
});

test("returns clean errors for invalid requests", async () => {
  const missingGoalResponse = await invoke({ missionType: "TRAVEL" });
  const missingGoal = await missingGoalResponse.json();
  assert.equal(missingGoalResponse.status, 400);
  assert.equal(missingGoal.error.code, "INVALID_GOAL");

  const invalidTypeResponse = await invoke({
    goal: "Plan something",
    missionType: "NOT_A_MISSION_TYPE",
  });
  const invalidType = await invalidTypeResponse.json();
  assert.equal(invalidTypeResponse.status, 400);
  assert.equal(invalidType.error.code, "INVALID_MISSION_TYPE");
});

test("asks blocking travel questions, merges answers, and executes available APIs", async () => {
  const createResponse = await invoke({
    goal: "I am travelling to the United States",
    missionType: "TRAVEL",
  });
  const created = await createResponse.json();
  createdMissionIds.add(created.missionId);

  assert.equal(createResponse.status, 200);
  assert.equal(created.results.length, 0);
  assert.equal(created.tasks.length, 0);
  assert.deepEqual(created.pendingQuestions, [
    "Where are you travelling from? Include a city or airport.",
    "What city or airport are you travelling to? A country alone is not precise enough.",
    "What is your departure date?",
  ]);

  const departureDate = futureDate(3);
  const resumeResponse = await invoke({
    goal: "Plan a flight from Lagos to New York",
    missionId: created.missionId,
    context: {
      origin: "Lagos",
      destination: "New York",
      departureDate,
      travelers: "1",
      cabin: "Economy",
      directFlights: "false",
    },
  });
  const resumed = await resumeResponse.json();
  const capabilities = resumed.results.map((result: any) => result.capability);

  assert.equal(resumeResponse.status, 200);
  assert.equal(resumed.missionId, created.missionId);
  assert.deepEqual(resumed.pendingQuestions, []);
  assert.ok(capabilities.includes("mission-plan"));
  assert.ok(capabilities.includes("weather"));
  assert.ok(capabilities.includes("places"));
  assert.ok(capabilities.includes("transportation"));
  assert.ok(
    resumed.tasks.some(
      (task: any) =>
        task.capability === "weather" && task.status === "COMPLETED",
    ),
  );
  assert.ok(
    resumed.tasks.some(
      (task: any) =>
        task.capability === "flights" && task.status === "BLOCKED",
    ),
  );
  assert.equal(resumed.recommendations.length, 0);
  assert.equal(resumed.costBreakdown.total, 0);
  assert.ok(resumed.progress > 0 && resumed.progress < 100);

  const missionCount = await prisma.mission.count();
  const taskCount = await prisma.task.count({
    where: { missionId: created.missionId },
  });
  const evidenceCount = await prisma.missionResearchResult.count({
    where: { missionId: created.missionId },
  });
  const secondResponse = await invoke({
    goal: "Continue this travel mission",
    missionId: created.missionId,
  });
  const second = await secondResponse.json();
  assert.equal(second.missionId, created.missionId);
  assert.equal(await prisma.mission.count(), missionCount);
  assert.equal(
    await prisma.task.count({ where: { missionId: created.missionId } }),
    taskCount,
  );
  assert.equal(
    await prisma.missionResearchResult.count({
      where: { missionId: created.missionId },
    }),
    evidenceCount,
  );
});

test("reopens a ready mission to explore a recommendation and keeps the same id", async () => {
  const createResponse = await invoke({
    goal: "Research how urban public transport systems work",
    missionType: "CUSTOM",
    context: {
      desiredOutcome:
        "Compare evidence about urban public transport systems",
    },
  });
  const created = await createResponse.json();
  createdMissionIds.add(created.missionId);

  assert.equal(createResponse.status, 200);
  assert.equal(created.status, "READY");
  assert.equal(created.progress, 100);
  assert.ok(created.recommendations.length > 0);
  const missionCount = await prisma.mission.count();

  const response = await invoke({
    goal: created.results[0].data.goal,
    missionId: created.missionId,
    action: {
      type: "EXPLORE_RECOMMENDATION",
      recommendationId: created.recommendations[0].id,
      query: "Find more current evidence about metro reliability",
    },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.missionId, created.missionId);
  assert.equal(body.status, "READY");
  assert.equal(await prisma.mission.count(), missionCount);
  assert.ok(body.recommendations.length > 0);
  assert.match(JSON.stringify(body.results), /metro reliability/i);
});

test("does not substitute current weather outside the forecast horizon", async () => {
  const response = await invoke({
    goal: "Plan a future trip from Lagos to New York",
    missionType: "TRAVEL",
    context: {
      origin: "Lagos",
      destination: "New York",
      departureDate: "2027-06-01",
    },
  });
  const body = await response.json();
  createdMissionIds.add(body.missionId);
  const weather = body.results.find(
    (result: any) => result.capability === "weather",
  );

  assert.equal(response.status, 200);
  assert.equal(weather.data.status, "OUT_OF_RANGE");
  assert.equal(weather.data.forecast, null);
  assert.match(weather.data.note, /will not substitute current weather/i);
});

test("study abroad uses its own workflow and blocks instead of fabricating", async () => {
  const response = await invoke({
    goal: "Find a practical master's program that can lead to data work",
    missionType: "STUDY_ABROAD",
    context: {
      destination: "United Kingdom",
      subject: "Data Science",
      studyLevel: "Master's",
      intake: "September 2027",
    },
  });
  const body = await response.json();
  createdMissionIds.add(body.missionId);

  assert.equal(response.status, 200);
  assert.equal(body.missionType, "STUDY_ABROAD");
  assert.equal(body.tasks.length, 7);
  assert.deepEqual(
    body.tasks.map((task: any) => task.capability),
    [
      "universities",
      "programs",
      "scholarships",
      "visa",
      "accommodation",
      "budget",
      "recommendations",
    ],
  );
  assert.equal(body.recommendations.length, 0);
  assert.equal(body.costBreakdown.total, 0);
  assert.match(body.currentActivity, /TAVILY_API_KEY|provider/i);
});

test("rejects an invalid recommendation action", async () => {
  const response = await invoke({
    goal: "Plan a trip",
    action: { type: "UNKNOWN", recommendationId: "" },
  });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "INVALID_ACTION");
});

test(
  "returns live Amadeus evidence when credentials are configured",
  { skip: !process.env.AMADEUS_CLIENT_ID || !process.env.AMADEUS_CLIENT_SECRET },
  async () => {
    const response = await invoke({
      goal: "Find a flight from Lagos to New York",
      missionType: "TRAVEL",
      context: {
        origin: "Lagos",
        destination: "New York",
        departureDate: futureDate(7),
      },
    });
    const body = await response.json();
    createdMissionIds.add(body.missionId);
    assert.equal(response.status, 200);
    assert.ok(
      body.results.some((result: any) => result.capability === "airports"),
    );
    assert.ok(
      body.results.some((result: any) => result.capability === "flights"),
    );
  },
);

function invoke(body: Record<string, unknown>): Promise<Response> {
  return POST(
    new Request("http://localhost/api/a2mcp/mission", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function futureDate(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function mockProviderFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url,
  );

  if (url.hostname === "geocoding-api.open-meteo.com") {
    return jsonResponse({
      results: [
        {
          name: "New York",
          country: "United States",
          latitude: 40.7128,
          longitude: -74.006,
        },
      ],
    });
  }

  if (url.hostname === "api.open-meteo.com") {
    const date = url.searchParams.get("start_date") ?? futureDate(3);
    return jsonResponse({
      timezone: "America/New_York",
      daily: {
        time: [date],
        temperature_2m_max: [28],
        temperature_2m_min: [21],
        precipitation_probability_max: [25],
        wind_speed_10m_max: [18],
        weather_code: [2],
      },
    });
  }

  if (url.hostname === "photon.komoot.io") {
    const query = url.searchParams.get("q") ?? "place";
    return jsonResponse({
      features: [
        {
          geometry: { coordinates: [-74.001, 40.715] },
          properties: {
            name: `${query.replace(/\b\w/g, (value) => value.toUpperCase())} Test Result`,
            osm_id: Math.abs(hashCode(query)),
            osm_type: "N",
          },
        },
      ],
    });
  }

  if (url.hostname === "en.wikipedia.org") {
    const query = url.searchParams.get("srsearch") ?? "mission evidence";
    return jsonResponse({
      query: {
        search: [
          {
            pageid: Math.abs(hashCode(query)),
            title: query,
            snippet: `Current background evidence for ${query}`,
          },
        ],
      },
    });
  }

  return originalFetch(input, init);
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function hashCode(value: string): number {
  return [...value].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) | 0,
    7,
  );
}
