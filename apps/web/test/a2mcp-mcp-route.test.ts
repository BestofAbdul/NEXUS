import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  DELETE,
  GET,
  POST,
} from "../app/api/mcp/route.js";

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

test("exposes mission create and resume through Streamable HTTP MCP", async () => {
  const client = new Client({
    name: "nexus-mcp-route-test",
    version: "1.0.0",
  });
  const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost/api/mcp"),
    { fetch: routeFetch },
  );

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map((tool) => tool.name),
      ["nexus_mission"],
    );

    const createdResult = await client.callTool({
      name: "nexus_mission",
      arguments: {
        goal: "Prepare for a senior engineering job search",
        missionType: "NEW_JOB",
      },
    });
    assert.equal(createdResult.isError, undefined);
    const created = readStructuredMission(createdResult.structuredContent);
    createdMissionIds.add(created.missionId);

    assert.equal(created.accepted, true);
    assert.deepEqual(created.results, []);
    assert.deepEqual(created.recommendations, []);
    assert.equal(created.costBreakdown.total, 0);

    const missionCountAfterCreate = await prisma.mission.count();
    const resumedResult = await client.callTool({
      name: "nexus_mission",
      arguments: {
        goal: "Continue the engineering job-search mission",
        missionId: created.missionId,
      },
    });
    assert.equal(resumedResult.isError, undefined);
    const resumed = readStructuredMission(resumedResult.structuredContent);

    assert.equal(resumed.missionId, created.missionId);
    assert.equal(await prisma.mission.count(), missionCountAfterCreate);
    assert.equal(
      await prisma.missionResearchResult.count({
        where: { missionId: created.missionId },
      }),
      0,
    );
    assert.equal(
      await prisma.recommendation.count({
        where: { missionId: created.missionId },
      }),
      0,
    );
    assert.equal(
      await prisma.costEstimate.count({
        where: { missionId: created.missionId },
      }),
      0,
    );
  } finally {
    await client.close();
  }
});

async function routeFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const request = new Request(input, init);

  if (request.method === "POST") {
    return POST(request);
  }
  if (request.method === "GET") {
    return GET(request);
  }
  if (request.method === "DELETE") {
    return DELETE(request);
  }

  return new Response(null, { status: 405 });
}

interface MissionToolResponse {
  accepted: boolean;
  missionId: string;
  results: unknown[];
  recommendations: unknown[];
  costBreakdown: { total: number };
}

function readStructuredMission(value: unknown): MissionToolResponse {
  assert.ok(value && typeof value === "object");
  return value as MissionToolResponse;
}
