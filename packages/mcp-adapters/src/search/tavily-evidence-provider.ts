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
  answer: z.string().nullable(),
  items: z.array(z.object(evidenceItemShape)),
  searchedAt: z.string(),
};

const evidenceSearchSchema = z.object(evidenceSearchShape);
const extractedItemShape = {
  url: z.string(),
  rawContent: z.string(),
  images: z.array(z.string()),
};
const evidenceExtractShape = {
  source: z.literal("Tavily"),
  query: z.string(),
  items: z.array(z.object(extractedItemShape)),
  failedUrls: z.array(z.string()),
  extractedAt: z.string(),
};
const evidenceExtractSchema = z.object(evidenceExtractShape);
const evidenceCrawlShape = {
  source: z.literal("Tavily"),
  baseUrl: z.string(),
  instructions: z.string(),
  items: z.array(z.object(extractedItemShape)),
  crawledAt: z.string(),
};
const evidenceCrawlSchema = z.object(evidenceCrawlShape);
const tavilyResponseSchema = z.object({
  answer: z.string().nullable().optional(),
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      content: z.string(),
      score: z.number().default(0),
    }),
  ),
});
const tavilyExtractResponseSchema = z.object({
  results: z.array(
    z.object({
      url: z.string(),
      raw_content: z.string().nullable().optional(),
      images: z.array(z.string()).optional(),
    }),
  ),
  failed_results: z
    .array(z.object({ url: z.string() }))
    .optional()
    .default([]),
});
const tavilyCrawlResponseSchema = z.object({
  base_url: z.string(),
  results: z.array(
    z.object({
      url: z.string(),
      raw_content: z.string().nullable().optional(),
      images: z.array(z.string()).optional(),
    }),
  ),
});

export type EvidenceSearch = z.infer<typeof evidenceSearchSchema>;
export type EvidenceExtract = z.infer<typeof evidenceExtractSchema>;
export type EvidenceCrawl = z.infer<typeof evidenceCrawlSchema>;

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
  "government-documents",
  "relocation",
  "events",
  "transportation",
  "knowledge",
] as const;

export class TavilyEvidenceProvider implements MCPProvider {
  readonly id = "tavily-evidence-search";
  readonly capabilities = searchableCapabilities;
  private readonly apiKey?: string;

  constructor(apiKey = process.env.TAVILY_API_KEY) {
    this.apiKey = apiKey;
  }

  async invoke(
    request: MCPRequest,
  ): Promise<MCPResponse<EvidenceSearch | EvidenceExtract | EvidenceCrawl>> {
    if (
      !this.capabilities.includes(
        request.capability as (typeof searchableCapabilities)[number],
      ) ||
      !["search", "extract", "crawl"].includes(request.operation)
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
        name:
          request.operation === "extract"
            ? "extract_source_evidence"
            : request.operation === "crawl"
              ? "crawl_source_evidence"
              : "search_live_evidence",
        arguments:
          request.operation === "extract"
            ? {
                urls: request.input.urls,
                query: query.trim(),
              }
            : request.operation === "crawl"
              ? {
                  url: request.input.url,
                  instructions: query.trim(),
                }
              : {
                  capability: request.capability,
                  query: query.trim(),
                  officialOnly: request.input.officialOnly === true,
                  includeDomains: request.input.includeDomains,
                  excludeDomains: request.input.excludeDomains,
                },
      });
      if ("toolResult" in result || result.isError || !result.structuredContent) {
        return {
          ok: false,
          error: readToolError(result.content) ?? "Evidence MCP tool failed.",
        };
      }
      const data =
        request.operation === "extract"
          ? evidenceExtractSchema.parse(result.structuredContent)
          : request.operation === "crawl"
            ? evidenceCrawlSchema.parse(result.structuredContent)
            : evidenceSearchSchema.parse(result.structuredContent);
      return {
        ok: true,
        data,
        metadata: {
          protocol: "MCP",
          transport: "in-memory",
          serverName: client.getServerVersion()?.name,
          tool:
            request.operation === "extract"
              ? "extract_source_evidence"
              : request.operation === "crawl"
                ? "crawl_source_evidence"
                : "search_live_evidence",
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
        includeDomains: z.array(z.string().min(1)).max(20).default([]),
        excludeDomains: z.array(z.string().min(1)).max(20).default([]),
      },
      outputSchema: evidenceSearchShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({
      capability,
      query,
      officialOnly,
      includeDomains,
      excludeDomains,
    }) => {
      const preferredDomains =
        includeDomains.length > 0
          ? includeDomains
          : officialOnly
            ? officialDomainHints(query)
            : [];
      const excludedDomains = excludeDomains.filter(
        (domain) => !preferredDomains.includes(domain),
      );
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "NEXUS/1.0 evidence MCP provider",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          search_depth: "advanced",
          max_results: 8,
          include_answer: "advanced",
          include_raw_content: false,
          topic: "general",
          ...(preferredDomains.length > 0
            ? { include_domains: preferredDomains }
            : {}),
          ...(excludedDomains.length > 0
            ? { exclude_domains: excludedDomains }
            : {}),
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
        answer: payload.answer?.trim() || null,
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
  server.registerTool(
    "extract_source_evidence",
    {
      description:
        "Extract query-relevant chunks from a bounded list of evidence URLs returned by search.",
      inputSchema: {
        urls: z.array(z.string().url()).min(1).max(3),
        query: z.string().min(3),
      },
      outputSchema: evidenceExtractShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ urls, query }) => {
      const response = await tavilyFetch(
        "https://api.tavily.com/extract",
        apiKey,
        {
          urls,
          query,
          chunks_per_source: 3,
          extract_depth: "advanced",
          format: "markdown",
          include_images: false,
        },
      );
      const payload = tavilyExtractResponseSchema.parse(response);
      const data: EvidenceExtract = {
        source: "Tavily",
        query,
        extractedAt: new Date().toISOString(),
        failedUrls: payload.failed_results.map((item) => item.url),
        items: payload.results
          .filter((item) => item.raw_content?.trim())
          .map((item) => ({
            url: item.url,
            rawContent: item.raw_content!.trim(),
            images: item.images ?? [],
          })),
      };
      return toolResult(data);
    },
  );
  server.registerTool(
    "crawl_source_evidence",
    {
      description:
        "Crawl a single authoritative site with strict depth and page limits for an explicit deep-research request.",
      inputSchema: {
        url: z.string().url(),
        instructions: z.string().min(3),
      },
      outputSchema: evidenceCrawlShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ url, instructions }) => {
      const response = await tavilyFetch(
        "https://api.tavily.com/crawl",
        apiKey,
        {
          url,
          instructions,
          max_depth: 1,
          max_breadth: 8,
          limit: 8,
          extract_depth: "advanced",
          format: "markdown",
          include_images: false,
        },
      );
      const payload = tavilyCrawlResponseSchema.parse(response);
      const data: EvidenceCrawl = {
        source: "Tavily",
        baseUrl: payload.base_url,
        instructions,
        crawledAt: new Date().toISOString(),
        items: payload.results
          .filter((item) => item.raw_content?.trim())
          .map((item) => ({
            url: item.url,
            rawContent: item.raw_content!.trim(),
            images: item.images ?? [],
          })),
      };
      return toolResult(data);
    },
  );
  return server;
}

async function tavilyFetch(
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "NEXUS/1.0 evidence MCP provider",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(35_000),
  });
  if (!response.ok) {
    throw new Error(`Tavily request failed with HTTP ${response.status}.`);
  }
  return response.json();
}

function toolResult(data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent: data,
  };
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
