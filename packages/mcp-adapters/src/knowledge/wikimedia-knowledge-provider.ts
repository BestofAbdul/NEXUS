import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { MCPProvider, MCPRequest, MCPResponse } from "../index";

const knowledgeItemShape = {
  title: z.string(),
  excerpt: z.string(),
  pageId: z.number(),
};

const knowledgeSearchShape = {
  source: z.literal("Wikimedia"),
  query: z.string(),
  items: z.array(z.object(knowledgeItemShape)),
};

const knowledgeSearchSchema = z.object(knowledgeSearchShape);

const wikipediaResponseSchema = z.object({
  query: z
    .object({
      search: z.array(
        z.object({
          pageid: z.number(),
          title: z.string(),
          snippet: z.string(),
        }),
      ),
    })
    .optional(),
});

export type KnowledgeSearch = z.infer<typeof knowledgeSearchSchema>;

export class WikimediaKnowledgeProvider implements MCPProvider {
  readonly id = "wikimedia-knowledge-search";
  readonly capabilities = ["knowledge"] as const;

  async invoke(request: MCPRequest): Promise<MCPResponse<KnowledgeSearch>> {
    if (request.capability !== "knowledge" || request.operation !== "search") {
      return {
        ok: false,
        error: `Unsupported knowledge request: ${request.capability}/${request.operation}`,
      };
    }

    const query = request.input.query;
    if (typeof query !== "string" || query.trim().length === 0) {
      return { ok: false, error: "Knowledge search requires a query." };
    }

    const server = createKnowledgeServer();
    const client = new Client({
      name: "nexus-knowledge-client",
      version: "1.0.0",
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const result = await client.callTool({
        name: "search_knowledge",
        arguments: { query: query.trim() },
      });
      if ("toolResult" in result || result.isError || !result.structuredContent) {
        return {
          ok: false,
          error: readToolError(result.content) ?? "Knowledge MCP tool failed.",
        };
      }

      const knowledge = knowledgeSearchSchema.parse(result.structuredContent);
      const serverVersion = client.getServerVersion();
      return {
        ok: true,
        data: knowledge,
        metadata: {
          protocol: "MCP",
          transport: "in-memory",
          serverName: serverVersion?.name,
          serverVersion: serverVersion?.version,
          tool: "search_knowledge",
        },
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown knowledge MCP provider failure.",
      };
    } finally {
      await Promise.allSettled([client.close(), server.close()]);
    }
  }
}

function createKnowledgeServer(): McpServer {
  const server = new McpServer({
    name: "nexus-wikimedia-knowledge",
    version: "1.0.0",
  });

  server.registerTool(
    "search_knowledge",
    {
      description:
        "Search Wikimedia for background topics relevant to a mission goal.",
      inputSchema: {
        query: z.string().min(2).describe("Mission-specific research query"),
      },
      outputSchema: knowledgeSearchShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ query }) => {
      const result = await fetchKnowledge(query);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );

  return server;
}

async function fetchKnowledge(query: string): Promise<KnowledgeSearch> {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", query);
  url.searchParams.set("srlimit", "5");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const payload = wikipediaResponseSchema.parse(await fetchJsonWithRetry(url));
  return {
    source: "Wikimedia",
    query,
    items: (payload.query?.search ?? []).map((item) => ({
      title: item.title,
      excerpt: stripHtml(item.snippet),
      pageId: item.pageid,
    })),
  };
}

async function fetchJsonWithRetry(url: URL): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "NEXUS/1.0 knowledge MCP provider" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) {
        throw new Error(`Wikimedia request failed with HTTP ${response.status}.`);
      }
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Wikimedia knowledge search failed.");
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&amp;", "&")
    .trim();
}

function readToolError(content: unknown): string | undefined {
  if (!Array.isArray(content)) {
    return undefined;
  }

  const item = content.find(
    (entry): entry is { type: string; text?: string } =>
      typeof entry === "object" &&
      entry !== null &&
      "type" in entry &&
      entry.type === "text",
  );
  return item?.text;
}
