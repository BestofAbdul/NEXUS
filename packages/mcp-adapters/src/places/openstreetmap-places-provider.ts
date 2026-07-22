import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { MCPProvider, MCPRequest, MCPResponse } from "../index";

const nearbyPlaceShape = {
  title: z.string(),
  category: z.string(),
  distanceMeters: z.number(),
  latitude: z.number(),
  longitude: z.number(),
  osmType: z.string(),
  osmId: z.number(),
};

const nearbyPlacesShape = {
  source: z.literal("OpenStreetMap"),
  center: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  places: z.array(z.object(nearbyPlaceShape)),
};

const nearbyPlacesSchema = z.object(nearbyPlacesShape);

const photonResponseSchema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({
        coordinates: z.tuple([z.number(), z.number()]),
      }),
      properties: z.object({
        name: z.string().optional(),
        osm_id: z.number().optional(),
        osm_type: z.string().optional(),
      }),
    }),
  ),
});

export type NearbyPlaces = z.infer<typeof nearbyPlacesSchema>;

export class OpenStreetMapPlacesProvider implements MCPProvider {
  readonly id = "openstreetmap-nearby-places";
  readonly capabilities = ["places"] as const;

  async invoke(request: MCPRequest): Promise<MCPResponse<NearbyPlaces>> {
    if (request.capability !== "places" || request.operation !== "nearby") {
      return {
        ok: false,
        error: `Unsupported places request: ${request.capability}/${request.operation}`,
      };
    }

    const latitude = request.input.latitude;
    const longitude = request.input.longitude;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return {
        ok: false,
        error: "Nearby place requests require numeric coordinates.",
      };
    }

    const server = createPlacesServer();
    const client = new Client({
      name: "nexus-places-client",
      version: "1.0.0",
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const result = await client.callTool({
        name: "find_nearby_places",
        arguments: { latitude, longitude },
      });

      if ("toolResult" in result || result.isError || !result.structuredContent) {
        return {
          ok: false,
          error: readToolError(result.content) ?? "Places MCP tool failed.",
        };
      }

      const places = nearbyPlacesSchema.parse(result.structuredContent);
      const serverVersion = client.getServerVersion();
      return {
        ok: true,
        data: places,
        metadata: {
          protocol: "MCP",
          transport: "in-memory",
          serverName: serverVersion?.name,
          serverVersion: serverVersion?.version,
          tool: "find_nearby_places",
        },
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown places MCP provider failure.",
      };
    } finally {
      await Promise.allSettled([client.close(), server.close()]);
    }
  }
}

function createPlacesServer(): McpServer {
  const server = new McpServer({
    name: "nexus-openstreetmap-places",
    version: "1.0.0",
  });

  server.registerTool(
    "find_nearby_places",
    {
      description:
        "Return named attractions, museums, viewpoints, and parks near coordinates.",
      inputSchema: {
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      },
      outputSchema: nearbyPlacesShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ latitude, longitude }) => {
      const places = await fetchNearbyPlaces(latitude, longitude);
      return {
        content: [{ type: "text", text: JSON.stringify(places) }],
        structuredContent: places,
      };
    },
  );

  return server;
}

async function fetchNearbyPlaces(
  latitude: number,
  longitude: number,
): Promise<NearbyPlaces> {
  const categories = ["museum", "tourist attraction", "park", "art gallery"];
  const searches = await Promise.all(
    categories.map(async (category) => ({
      category,
      payload: photonResponseSchema.parse(
        await fetchJsonWithRetry(
          photonUrl(category, latitude, longitude),
        ),
      ),
    })),
  );
  const uniqueNames = new Set<string>();
  const places = searches
    .flatMap(({ category, payload }) =>
      payload.features.map((feature) => ({ category, feature })),
    )
    .map(({ category, feature }) => {
      const title = feature.properties.name;
      const [placeLongitude, placeLatitude] = feature.geometry.coordinates;
      const distanceMeters = Math.round(
        distanceBetween(
          latitude,
          longitude,
          placeLatitude,
          placeLongitude,
        ),
      );
      if (
        !title ||
        distanceMeters > 20_000 ||
        isGenericPlaceName(title) ||
        uniqueNames.has(title)
      ) {
        return null;
      }
      uniqueNames.add(title);
      return {
        title,
        category,
        distanceMeters,
        latitude: placeLatitude,
        longitude: placeLongitude,
        osmType: feature.properties.osm_type ?? "unknown",
        osmId: feature.properties.osm_id ?? 0,
      };
    })
    .filter((place): place is NonNullable<typeof place> => place !== null)
    .sort((left, right) => left.distanceMeters - right.distanceMeters)
    .slice(0, 12);

  return {
    source: "OpenStreetMap",
    center: { latitude, longitude },
    places,
  };
}

function isGenericPlaceName(title: string): boolean {
  const normalized = title.toLowerCase().replace(/[^a-z]/g, "");
  return [
    "museum",
    "artgallery",
    "gallery",
    "park",
    "touristattraction",
    "attraction",
  ].includes(normalized);
}

function photonUrl(
  query: string,
  latitude: number,
  longitude: number,
): URL {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("limit", "6");
  url.searchParams.set("lang", "en");
  return url;
}

async function fetchJsonWithRetry(url: URL): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "NEXUS/1.0 places MCP provider" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) {
        throw new Error(`OpenStreetMap request failed with HTTP ${response.status}.`);
      }
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 800 * 2 ** attempt));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("OpenStreetMap nearby-place search failed.");
}

function distanceBetween(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitudeA)) *
      Math.cos(radians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
