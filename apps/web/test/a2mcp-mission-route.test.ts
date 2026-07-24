import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const createdMissionIds = new Set<string>();
const originalFetch = globalThis.fetch;
const originalTavilyApiKey = process.env.TAVILY_API_KEY;
const originalAmadeusClientId = process.env.AMADEUS_CLIENT_ID;
const originalAmadeusClientSecret = process.env.AMADEUS_CLIENT_SECRET;
const tavilyOperations: string[] = [];
const tavilySearchBodies: Array<Record<string, unknown>> = [];

process.env.TAVILY_API_KEY = "test-tavily-key";
delete process.env.AMADEUS_CLIENT_ID;
delete process.env.AMADEUS_CLIENT_SECRET;

let POST: typeof import("../app/api/a2mcp/mission/route.js").POST;

test.before(async () => {
  ({ POST } = await import("../app/api/a2mcp/mission/route.js"));
  globalThis.fetch = mockProviderFetch;
});

test.after(async () => {
  if (createdMissionIds.size > 0) {
    await prisma.mission.deleteMany({
      where: { id: { in: [...createdMissionIds] } },
    });
  }
  globalThis.fetch = originalFetch;
  restoreEnvironment("TAVILY_API_KEY", originalTavilyApiKey);
  restoreEnvironment("AMADEUS_CLIENT_ID", originalAmadeusClientId);
  restoreEnvironment("AMADEUS_CLIENT_SECRET", originalAmadeusClientSecret);
  await prisma.$disconnect();
});

test("creates a Tavily-backed evidence workflow instead of assumed job advice", async () => {
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
  assert.equal(body.status, "READY");
  assert.equal(body.progress, 100);
  assert.deepEqual(body.pendingQuestions, []);
  assert.equal(body.results.length, 5);
  assert.equal(body.results[0].capability, "mission-plan");
  assert.equal(body.tasks.length, 5);
  assert.ok(body.tasks.every((task: any) => task.capability));
  assert.ok(body.tasks.every((task: any) => task.status === "COMPLETED"));
  assert.match(body.currentActivity, /ready from verified evidence/i);
  assert.ok(body.recommendations.length > 0);
  assert.equal(body.costBreakdown.total, 0);
  assert.equal(body.executionSummary.blockedTasks.length, 0);
  assert.equal(body.executionSummary.evidenceCollected.length, 4);
  assert.ok(body.executionSummary.averageConfidence > 0);
  assert.match(body.results[1].summary, /Tavily synthesized evidence/i);
  assert.ok(body.timeline.some((entry: any) => entry.kind === "WORKFLOW_CREATED"));
  assert.ok(body.timeline.some((entry: any) => entry.kind === "EVIDENCE_STORED"));
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
  assert.equal(
    resumed.tasks.find((task: any) => task.capability === "flights")
      .blockedReason,
    "No flight provider configured",
  );
  assert.equal(resumed.status, "READY");
  assert.ok(resumed.recommendations.length > 0);
  assert.equal(resumed.costBreakdown.total, 0);
  assert.ok(resumed.progress > 0 && resumed.progress < 100);
  assert.ok(
    resumed.executionSummary.pendingActions.some((action: string) =>
      action.includes("flights capability"),
    ),
  );
  assert.ok(
    resumed.executionSummary.evidenceCollected.every(
      (evidence: any) => typeof evidence.confidenceScore === "number",
    ),
  );

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
  assert.equal(body.status, "READY");
  assert.ok(body.recommendations.length > 0);
  assert.equal(body.costBreakdown.total, 0);
  assert.equal(body.executionSummary.blockedTasks.length, 1);
  assert.equal(
    body.executionSummary.blockedTasks[0].capability,
    "budget",
  );
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

test("treats Amadeus as optional and reports the missing flight capability exactly", async () => {
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
  const flightTask = body.tasks.find(
    (task: any) => task.capability === "flights",
  );

  assert.equal(response.status, 200);
  assert.equal(body.status, "READY");
  assert.equal(flightTask.status, "BLOCKED");
  assert.equal(flightTask.blockedReason, "No flight provider configured");
  assert.ok(
    body.results.some((result: any) => result.capability === "weather"),
  );
  assert.ok(body.results.some((result: any) => result.capability === "visa"));
  assert.ok(body.recommendations.length > 0);
});

test("resolves free-text China and Benue currencies without an airport provider", async () => {
  const response = await invoke({
    goal: "Plan a trip from China to Benue",
    missionType: "TRAVEL",
    context: {
      origin: "china",
      destination: "benue",
      departureDate: futureDate(6),
    },
  });
  const body = await response.json();
  createdMissionIds.add(body.missionId);
  const currency = body.results.find(
    (result: any) => result.capability === "currency",
  );

  assert.equal(response.status, 200);
  assert.equal(currency.data.base, "CNY");
  assert.equal(currency.data.quote, "NGN");
  assert.equal(currency.data.originCountry.countryCode, "CN");
  assert.equal(currency.data.destinationCountry.countryCode, "NG");
  assert.equal(currency.data.destinationCountry.matchedBy, "LOCATION_GEOCODER");
  assert.match(
    currency.data.originCountry.sourceUrl,
    /raw\.githubusercontent\.com\/mledoze\/countries/i,
  );
  assert.match(
    currency.data.destinationCountry.sourceUrl,
    /raw\.githubusercontent\.com\/mledoze\/countries/i,
  );
  assert.ok(
    body.tasks.some(
      (task: any) =>
        task.capability === "airports" && task.status === "BLOCKED",
    ),
  );
  assert.ok(
    body.tasks.some(
      (task: any) =>
        task.capability === "currency" && task.status === "COMPLETED",
    ),
  );
  assert.ok(body.recommendations.length <= 3);
  const rawEvidenceExcerpts = body.results.flatMap((result: any) =>
    Array.isArray(result.data.items)
      ? result.data.items.map((item: any) => item.excerpt)
      : [],
  );
  assert.ok(
    body.recommendations.every(
      (recommendation: any) =>
        !rawEvidenceExcerpts.includes(recommendation.summary),
    ),
  );
});

test("builds capability-specific Tavily queries and excludes programming domains", async () => {
  const requestStart = tavilySearchBodies.length;
  const response = await invoke({
    goal: "Plan a trip from Lagos to New York",
    missionType: "TRAVEL",
    context: {
      origin: "Lagos",
      destination: "New York",
      departureDate: futureDate(8),
      cabin: "Business",
      preferences: "Quiet hotels and TypeScript conferences",
    },
  });
  const body = await response.json();
  createdMissionIds.add(body.missionId);
  const visaRequest = tavilySearchBodies
    .slice(requestStart)
    .find((item) => /^Current visa evidence/i.test(String(item.query)));

  assert.equal(response.status, 200);
  assert.ok(visaRequest);
  assert.match(String(visaRequest.query), /origin: Lagos/i);
  assert.match(String(visaRequest.query), /destination: New York/i);
  assert.doesNotMatch(String(visaRequest.query), /Business|TypeScript|Quiet/i);
  assert.ok(
    Array.isArray(visaRequest.exclude_domains) &&
      visaRequest.exclude_domains.includes("stackoverflow.com"),
  );
});

test("continues a blocked mission from a natural conversation answer", async () => {
  const createResponse = await invoke({
    goal: "Plan my trip to the United States",
    missionType: "TRAVEL",
  });
  const created = await createResponse.json();
  createdMissionIds.add(created.missionId);
  const missionCount = await prisma.mission.count();
  const departureDate = futureDate(5);

  const response = await invoke({
    goal: created.results[0]?.data?.goal ?? "Plan my trip to the United States",
    missionId: created.missionId,
    message: `I am travelling from Lagos to New York on ${departureDate}.`,
  });
  const body = await response.json();
  const stored = await prisma.mission.findUniqueOrThrow({
    where: { id: created.missionId },
    include: { conversation: { orderBy: { createdAt: "asc" } } },
  });

  assert.equal(response.status, 200);
  assert.equal(body.missionId, created.missionId);
  assert.equal(await prisma.mission.count(), missionCount);
  assert.deepEqual(body.pendingQuestions, []);
  assert.equal(stored.conversation.length, 2);
  assert.equal(stored.conversation[0].role, "USER");
  assert.equal(stored.conversation[1].role, "AGENT");
  assert.match(stored.conversation[1].content, /updated/i);
  assert.match(stored.setupAnswersJson, /Lagos/);
  assert.match(stored.setupAnswersJson, /New York/);
  assert.match(stored.setupAnswersJson, new RegExp(departureDate));
  assert.ok(body.tasks.length > 0);
  assert.ok(
    body.results.some((result: any) => result.capability === "weather"),
  );
});

test("deep conversation research persists Tavily search, extract, and crawl evidence", async () => {
  const createResponse = await invoke({
    goal: "Find a senior platform engineering role",
    missionType: "NEW_JOB",
    context: {
      targetRole: "Senior Platform Engineer",
      location: "Remote Europe",
    },
  });
  const created = await createResponse.json();
  createdMissionIds.add(created.missionId);
  const missionCount = await prisma.mission.count();
  const taskCount = await prisma.task.count({
    where: { missionId: created.missionId },
  });
  const resultCount = await prisma.missionResearchResult.count({
    where: { missionId: created.missionId },
  });
  const operationStart = tavilyOperations.length;

  const response = await invoke({
    goal: "Continue the senior platform engineering mission",
    missionId: created.missionId,
    message:
      "Deeply verify and compare the current hiring evidence using official sources.",
  });
  const body = await response.json();
  const conversationEvidence = body.results.find(
    (result: any) => result.capability === "conversation-research",
  );
  const operations = tavilyOperations.slice(operationStart);

  assert.equal(response.status, 200);
  assert.equal(body.missionId, created.missionId);
  assert.equal(await prisma.mission.count(), missionCount);
  assert.equal(
    await prisma.task.count({ where: { missionId: created.missionId } }),
    taskCount,
  );
  assert.equal(
    await prisma.missionResearchResult.count({
      where: { missionId: created.missionId },
    }),
    resultCount + 1,
  );
  assert.deepEqual(operations, ["search", "search", "extract", "crawl"]);
  assert.equal(conversationEvidence.data.verification.searchCount, 2);
  assert.ok(conversationEvidence.data.extraction.items.length > 0);
  assert.ok(conversationEvidence.data.crawl.items.length > 0);
  assert.ok(conversationEvidence.sourceUrls.length >= 2);
  assert.equal(body.conversation.length, 2);
  assert.equal(body.conversation[0].role, "USER");
  assert.equal(body.conversation[1].role, "AGENT");
  assert.match(body.conversation[1].content, /verified/i);
});

test("returns clean errors for invalid conversation input", async () => {
  const withoutMission = await invoke({
    goal: "Continue",
    message: "Research this",
  });
  const withoutMissionBody = await withoutMission.json();
  assert.equal(withoutMission.status, 400);
  assert.equal(
    withoutMissionBody.error.code,
    "MESSAGE_REQUIRES_MISSION",
  );

  const empty = await invoke({
    goal: "Continue",
    missionId: "mission-id",
    message: "   ",
  });
  const emptyBody = await empty.json();
  assert.equal(empty.status, 400);
  assert.equal(emptyBody.error.code, "INVALID_MESSAGE");

  const oversized = await invoke({
    goal: "Continue",
    missionId: "mission-id",
    message: "x".repeat(4_001),
  });
  const oversizedBody = await oversized.json();
  assert.equal(oversized.status, 400);
  assert.equal(oversizedBody.error.code, "INVALID_MESSAGE");
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
    const location = url.searchParams.get("name") ?? "New York";
    const isLagos = /lagos/i.test(location);
    const isBenue = /benue/i.test(location);
    const isChina = /china/i.test(location);
    return jsonResponse({
      results: [
        {
          name: isLagos
            ? "Lagos"
            : isBenue
              ? "Benue"
              : isChina
                ? "China"
                : "New York",
          country: isLagos || isBenue
            ? "Nigeria"
            : isChina
              ? "China"
              : "United States",
          country_code: isLagos || isBenue ? "NG" : isChina ? "CN" : "US",
          latitude: isLagos || isBenue ? 6.5244 : 40.7128,
          longitude: isLagos || isBenue ? 3.3792 : -74.006,
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

  if (url.hostname === "api.tavily.com") {
    const requestBody =
      typeof init?.body === "string" ? JSON.parse(init.body) : {};
    if (url.pathname.endsWith("/extract")) {
      tavilyOperations.push("extract");
      return jsonResponse({
        results: (requestBody.urls ?? []).map((sourceUrl: string) => ({
          url: sourceUrl,
          raw_content: `Extracted current evidence for ${requestBody.query}.`,
          images: [],
        })),
        failed_results: [],
      });
    }
    if (url.pathname.endsWith("/crawl")) {
      tavilyOperations.push("crawl");
      return jsonResponse({
        base_url: requestBody.url,
        results: [
          {
            url: `${requestBody.url}/details`,
            raw_content: `Crawled authoritative details for ${requestBody.instructions}.`,
            images: [],
          },
        ],
      });
    }
    tavilyOperations.push("search");
    tavilySearchBodies.push(requestBody);
    const query =
      typeof requestBody.query === "string"
        ? requestBody.query
        : "mission research";
    return jsonResponse({
      answer: `Tavily synthesized evidence for ${query}`,
      results: [
        {
          title: `Primary evidence for ${query}`,
          url: "https://example.gov/primary-evidence",
          content: `Verified source excerpt about ${query}.`,
          score: 0.92,
        },
        {
          title: `Supporting evidence for ${query}`,
          url: "https://example.edu/supporting-evidence",
          content: `Additional source excerpt about ${query}.`,
          score: 0.84,
        },
      ],
    });
  }

  if (url.hostname === "restcountries.com") {
    if (/\/name\/benue/i.test(url.pathname)) {
      return jsonResponse({ status: 404 }, 404);
    }
    return jsonResponse({
      success: false,
      data: null,
      errors: [
        {
          message:
            "This API version has been deprecated. Please migrate to the current API.",
        },
      ],
    });
  }

  if (
    url.hostname === "raw.githubusercontent.com" &&
    /mledoze\/countries/i.test(url.pathname)
  ) {
    return jsonResponse([
      {
        name: {
          common: "China",
          official: "People's Republic of China",
        },
        cca2: "CN",
        cca3: "CHN",
        altSpellings: ["CN", "China"],
        currencies: { CNY: { name: "Renminbi" } },
      },
      {
        name: {
          common: "Nigeria",
          official: "Federal Republic of Nigeria",
        },
        cca2: "NG",
        cca3: "NGA",
        altSpellings: ["NG", "Nigeria"],
        currencies: { NGN: { name: "Naira" } },
      },
      {
        name: {
          common: "United States",
          official: "United States of America",
        },
        cca2: "US",
        cca3: "USA",
        altSpellings: ["US", "USA", "United States of America"],
        currencies: { USD: { name: "United States dollar" } },
      },
    ]);
  }

  if (url.hostname === "api.frankfurter.dev") {
    const quote = url.searchParams.get("symbols") ?? "USD";
    return jsonResponse({
      date: new Date().toISOString().slice(0, 10),
      rates: { [quote]: 0.00065 },
    });
  }

  return originalFetch(input, init);
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function hashCode(value: string): number {
  return [...value].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) | 0,
    7,
  );
}

function restoreEnvironment(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
