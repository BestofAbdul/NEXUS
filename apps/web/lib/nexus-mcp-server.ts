import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { missionTypes } from "@nexus/shared";
import * as z from "zod/v4";
import {
  A2MCPMissionError,
  invokeA2MCPMission,
} from "@/lib/a2mcp-mission";

const missionRequestSchema = {
  goal: z
    .string()
    .trim()
    .min(1)
    .describe("The real-world goal NEXUS should turn into a mission"),
  missionType: z
    .enum(missionTypes)
    .optional()
    .describe("Optional mission category; defaults to CUSTOM"),
  missionId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Existing NEXUS mission ID to resume without duplication"),
  context: z
    .record(z.string(), z.string())
    .optional()
    .describe("Optional mission setup facts as string key-value pairs"),
  action: z
    .object({
      type: z.literal("EXPLORE_RECOMMENDATION"),
      recommendationId: z.string().min(1),
      query: z.string().optional(),
    })
    .optional()
    .describe("Optional evidence-expansion action for an existing mission"),
};

export function createNexusMcpServer(): McpServer {
  const server = new McpServer({
    name: "nexus-autonomous-mission-agent",
    version: "1.0.0",
  });

  server.registerTool(
    "nexus_mission",
    {
      title: "NEXUS Mission",
      description:
        "Create or resume a persistent autonomous mission. Returns research, ranked recommendations, informational costs, progress, and blocking questions. Never pays or books.",
      inputSchema: missionRequestSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (request) => {
      try {
        const response = await invokeA2MCPMission(request);
        return {
          content: [{ type: "text", text: JSON.stringify(response) }],
          structuredContent: response as unknown as Record<string, unknown>,
        };
      } catch (error) {
        const message =
          error instanceof A2MCPMissionError
            ? `${error.code}: ${error.message}`
            : "MISSION_INVOCATION_FAILED: The mission could not be processed.";

        return {
          isError: true,
          content: [{ type: "text", text: message }],
        };
      }
    },
  );

  return server;
}
