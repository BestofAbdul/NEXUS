import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { MCPProvider, MCPRequest, MCPResponse } from "../index";

const evidenceItemShape = {
  title: z.string(),
  url: z.string(),
  excerpt: z.string(),
  score: z.number(),
};

const evidenceSearchShape = {
  source: z.literal("Tavily"),
  query: z.string(),
  capability: z.string(),
  items: z.array(z.object(evidenceItemShape)),
  searchedAt: z.string(),
};

const evidenceSearchSchema = z.object(evidenceSearchShape);
const tavilyResponseSchema = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      content: z.string(),
      score: z.number().default(0),
    }),
  ),
});

export type EvidenceSearch = z.infer<typeof evidenceSearchSchema>;

const searchableCapabilities = [
  "visa",
  "immigration",
  "jobs",
  "housing",
  "healthcare",
  "schools",
  "taxes",
  "universities",
  "programs",
  "scholarships",
  "accommodation",
  "properties",
  "mortgage",
  "neighbourhood",
  "crime",
  "employers",
  "salary",
  "venues",
  "suppliers",
  "hospitals",
  "doctors",
  "insurance",
  "medical-visa",
  "recovery",
  "freight",
  "customs",
  "knowledge",
] as const;

export class TavilyEvidenceProvider implements MCPProvider {
  readonly id = "tavily-evidence-search";
  readonly capabilities = searchableCapabilities;
  private readonly apiKey?: string;

  constructor(apiKey = process.env.TAVILY_API_KEY) {
    this.apiKey = apiKey;
  }

  async invoke(request: MCPRequest): Promise<MCPResponse<EvidenceSearch>> {
    if (
      !this.capabilities.includes(
        request.capability as (typeof searchableCapabilities)[number],
      ) ||
      request.operation !== "search"
    ) {
      return {
        ok: false,
        error: `Unsupported evidence request: ${request.capability}/${request.operation}`,
      };
    }
    if (!this.apiKey) {
      return {
        ok: false,
        error:
          "Live evidence search is not configured. Set TAVILY_API_KEY.",
        metadata: { serviceState: "NOT_CONFIGURED" },
      };
    }

    const query = request.input.query;
    if (typeof query !== "string" || query.trim().length < 3) {
      return { ok: false, error: "Evidence search requires a query." };
    }

    const server = createServer(this.apiKey);
    const client = new Client({
      name: "nexus-evidence-client",
      version: "1.0.0",
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const result = await client.callTool({
        name: "search_live_evidence",
        arguments: {
          capability: request.capability,
          query: query.trim(),
          officialOnly: request.input.officialOnly === true,
        },
      });
      if ("toolResult" in result || result.isError || !result.structuredContent) {
        return {
          ok: false,
          error: readToolError(result.content) ?? "Evidence MCP tool failed.",
        };
      }
      const data = evidenceSearchSchema.parse(result.structuredContent);
      return {
        ok: true,
        data,
        metadata: {
          protocol: "MCP",
          transport: "in-memory",
          serverName: client.getServerVersion()?.name,
          tool: "search_live_evidence",
        },
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown evidence provider failure.",
      };
    } finally {
      await Promise.allSettled([client.close(), server.close()]);
    }
  }
}

function createServer(apiKey: string): McpServer {
  const server = new McpServer({
    name: "nexus-tavily-evidence",
    version: "1.0.0",
  });
  server.registerTool(
    "search_live_evidence",
    {
      description:
        "Search current web evidence and preserve source URLs for a mission capability.",
      inputSchema: {
        capability: z.string().min(1),
        query: z.string().min(3),
        officialOnly: z.boolean().default(false),
      },
      outputSchema: evidenceSearchShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ capability, query, officialOnly }) => {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "NEXUS/1.0 evidence MCP provider",
        },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: "advanced",
          max_results: 8,
          include_answer: false,
          include_raw_content: false,
          topic: "general",
          ...(officialOnly ? { include_domains: officialDomainHints(query) } : {}),
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) {
        throw new Error(
          `Tavily request failed with HTTP ${response.status}.`,
        );
      }
      const payload = tavilyResponseSchema.parse(await response.json());
      const data: EvidenceSearch = {
        source: "Tavily",
        query,
        capability,
        searchedAt: new Date().toISOString(),
        items: payload.results.map((item) => ({
          title: item.title,
          url: item.url,
          excerpt: item.content,
          score: item.score,
        })),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
        structuredContent: data,
      };
    },
  );
  return server;
}

function officialDomainHints(query: string): string[] {
  const normalized = query.toLowerCase();
  if (normalized.includes("united kingdom") || normalized.includes(" uk ")) {
    return ["gov.uk"];
  }
  if (normalized.includes("canada")) return ["canada.ca"];
  if (normalized.includes("united states") || normalized.includes(" usa ")) {
    return ["usa.gov", "uscis.gov", "irs.gov", "travel.state.gov"];
  }
  if (normalized.includes("australia")) return ["australia.gov.au", "homeaffairs.gov.au"];
  return [];
}

function readToolError(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;
  const item = content.find(
    (entry): entry is { type: string; text?: string } =>
      typeof entry === "object" &&
      entry !== null &&
      "type" in entry &&
      entry.type === "text",
  );
  return item?.text;
}
