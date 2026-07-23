import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { MCPProvider, MCPRequest, MCPResponse } from "../index";

const airportShape = {
  iataCode: z.string(),
  name: z.string(),
  cityName: z.string(),
  countryName: z.string(),
};

const segmentShape = {
  departureAirport: z.string(),
  departureAt: z.string(),
  arrivalAirport: z.string(),
  arrivalAt: z.string(),
  carrierCode: z.string(),
  flightNumber: z.string(),
  duration: z.string(),
};

const flightOfferShape = {
  id: z.string(),
  totalPrice: z.number(),
  currency: z.string(),
  validatingAirlines: z.array(z.string()),
  seatsAvailable: z.number().nullable(),
  stops: z.number(),
  duration: z.string(),
  segments: z.array(z.object(segmentShape)),
  lastTicketingDate: z.string().nullable(),
  source: z.literal("Amadeus"),
  fetchedAt: z.string(),
  bookingSearchUrl: z.string(),
  bookingLinkType: z.literal("SEARCH_LINK_NOT_CONFIRMED_FARE"),
};

const routeShape = {
  source: z.literal("Amadeus"),
  origin: z.object(airportShape),
  destination: z.object(airportShape),
};

const flightSearchShape = {
  source: z.literal("Amadeus"),
  environment: z.enum(["test", "production"]),
  query: z.object({
    origin: z.object(airportShape),
    destination: z.object(airportShape),
    departureDate: z.string(),
    returnDate: z.string().nullable(),
    adults: z.number(),
    travelClass: z.string(),
    nonStop: z.boolean(),
  }),
  offers: z.array(z.object(flightOfferShape)),
};

const hotelOfferShape = {
  id: z.string(),
  hotelId: z.string(),
  hotelName: z.string(),
  checkInDate: z.string(),
  checkOutDate: z.string(),
  totalPrice: z.number(),
  currency: z.string(),
  roomDescription: z.string().nullable(),
  source: z.literal("Amadeus"),
  fetchedAt: z.string(),
  bookingSearchUrl: z.string(),
  bookingLinkType: z.literal("SEARCH_LINK_NOT_CONFIRMED_FARE"),
};

const hotelSearchShape = {
  source: z.literal("Amadeus"),
  environment: z.enum(["test", "production"]),
  query: z.object({
    destinationCode: z.string(),
    checkInDate: z.string(),
    checkOutDate: z.string(),
    adults: z.number(),
  }),
  offers: z.array(z.object(hotelOfferShape)),
};

const routeSchema = z.object(routeShape);
const flightSearchSchema = z.object(flightSearchShape);
const hotelSearchSchema = z.object(hotelSearchShape);

export type AirportRoute = z.infer<typeof routeSchema>;
export type FlightOfferSearch = z.infer<typeof flightSearchSchema>;
export type HotelOfferSearch = z.infer<typeof hotelSearchSchema>;

const tokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
});

const locationsResponseSchema = z.object({
  data: z.array(
    z.object({
      iataCode: z.string(),
      name: z.string(),
      address: z.object({
        cityName: z.string().default("Unknown"),
        countryName: z.string().default("Unknown"),
      }),
      subType: z.string(),
    }),
  ),
});

const offersResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      lastTicketingDate: z.string().optional(),
      numberOfBookableSeats: z.number().optional(),
      validatingAirlineCodes: z.array(z.string()).default([]),
      price: z.object({
        currency: z.string(),
        total: z.string(),
      }),
      itineraries: z.array(
        z.object({
          duration: z.string(),
          segments: z.array(
            z.object({
              departure: z.object({
                iataCode: z.string(),
                at: z.string(),
              }),
              arrival: z.object({
                iataCode: z.string(),
                at: z.string(),
              }),
              carrierCode: z.string(),
              number: z.string(),
              duration: z.string(),
            }),
          ),
        }),
      ),
    }),
  ),
});

const hotelListResponseSchema = z.object({
  data: z.array(
    z.object({
      hotelId: z.string(),
      name: z.string(),
    }),
  ),
});

const hotelOffersResponseSchema = z.object({
  data: z.array(
    z.object({
      hotel: z.object({
        hotelId: z.string(),
        name: z.string(),
      }),
      offers: z.array(
        z.object({
          id: z.string(),
          checkInDate: z.string(),
          checkOutDate: z.string(),
          price: z.object({
            currency: z.string(),
            total: z.string(),
          }),
          room: z
            .object({
              description: z
                .object({ text: z.string().optional() })
                .optional(),
            })
            .optional(),
        }),
      ),
    }),
  ),
});

interface AmadeusConfig {
  clientId?: string;
  clientSecret?: string;
  environment: "test" | "production";
}

let cachedToken:
  | { value: string; environment: string; expiresAt: number }
  | undefined;

export class AmadeusFlightProvider implements MCPProvider {
  readonly id = "amadeus-flight-offers";
  readonly capabilities = ["airports", "flights", "hotels"] as const;
  private readonly config: AmadeusConfig;

  constructor(config: Partial<AmadeusConfig> = {}) {
    this.config = {
      clientId: config.clientId ?? process.env.AMADEUS_CLIENT_ID,
      clientSecret: config.clientSecret ?? process.env.AMADEUS_CLIENT_SECRET,
      environment:
        config.environment ??
        (process.env.AMADEUS_ENVIRONMENT === "production"
          ? "production"
          : "test"),
    };
  }

  async invoke(
    request: MCPRequest,
  ): Promise<MCPResponse<AirportRoute | FlightOfferSearch | HotelOfferSearch>> {
    if (!this.config.clientId || !this.config.clientSecret) {
      return {
        ok: false,
        error:
          "Live flight search is not configured. Set AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET.",
        metadata: { serviceState: "NOT_CONFIGURED" },
      };
    }

    if (
      !(
        (request.capability === "airports" &&
          request.operation === "resolve-route") ||
        (request.capability === "flights" &&
          request.operation === "search") ||
        (request.capability === "hotels" &&
          request.operation === "search")
      )
    ) {
      return {
        ok: false,
        error: `Unsupported Amadeus request: ${request.capability}/${request.operation}`,
      };
    }

    const server = createAmadeusServer(this.config);
    const client = new Client({
      name: "nexus-flight-client",
      version: "1.0.0",
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const name =
        request.capability === "airports"
          ? "resolve_airport_route"
          : request.capability === "flights"
            ? "search_flight_offers"
            : "search_hotel_offers";
      const result = await client.callTool({
        name,
        arguments: request.input,
      });
      if ("toolResult" in result || result.isError || !result.structuredContent) {
        return {
          ok: false,
          error: readToolError(result.content) ?? "Amadeus MCP tool failed.",
        };
      }

      const data = request.capability === "airports"
        ? routeShapeParse(result.structuredContent)
        : request.capability === "flights"
          ? flightSearchSchema.parse(result.structuredContent)
          : hotelSearchSchema.parse(result.structuredContent);
      const serverVersion = client.getServerVersion();
      return {
        ok: true,
        data,
        metadata: {
          protocol: "MCP",
          transport: "in-memory",
          serverName: serverVersion?.name,
          serverVersion: serverVersion?.version,
          tool: name,
          environment: this.config.environment,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Amadeus MCP provider failure.",
      };
    } finally {
      await Promise.allSettled([client.close(), server.close()]);
    }
  }
}

function createAmadeusServer(config: AmadeusConfig): McpServer {
  const server = new McpServer({
    name: "nexus-amadeus-flights",
    version: "1.0.0",
  });

  server.registerTool(
    "resolve_airport_route",
    {
      description:
        "Resolve human origin and destination text to Amadeus airport or city IATA codes.",
      inputSchema: {
        origin: z.string().min(1),
        destination: z.string().min(1),
      },
      outputSchema: routeShape,
      annotations: readOnlyAnnotations(),
    },
    async ({ origin, destination }) => {
      const route = await resolveRoute(config, origin, destination);
      return toolResult(route);
    },
  );

  server.registerTool(
    "search_hotel_offers",
    {
      description:
        "Return live Amadeus hotel offers for a destination city code and stay dates.",
      inputSchema: {
        destinationCode: z.string().length(3),
        checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        adults: z.number().int().min(1).max(9),
      },
      outputSchema: hotelSearchShape,
      annotations: readOnlyAnnotations(),
    },
    async (input) => {
      const search = await searchHotels(config, input);
      return toolResult(search);
    },
  );

  server.registerTool(
    "search_flight_offers",
    {
      description:
        "Return live Amadeus flight offers with schedules and prices for a resolved route.",
      inputSchema: {
        originLocationCode: z.string().length(3),
        destinationLocationCode: z.string().length(3),
        departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        adults: z.number().int().min(1).max(9),
        travelClass: z
          .enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"])
          .default("ECONOMY"),
        nonStop: z.boolean().default(false),
        origin: z.object(airportShape),
        destination: z.object(airportShape),
      },
      outputSchema: flightSearchShape,
      annotations: readOnlyAnnotations(),
    },
    async (input) => {
      const search = await searchFlights(config, input);
      return toolResult(search);
    },
  );

  return server;
}

async function searchHotels(
  config: AmadeusConfig,
  input: {
    destinationCode: string;
    checkInDate: string;
    checkOutDate: string;
    adults: number;
  },
): Promise<HotelOfferSearch> {
  const hotelsUrl = new URL(
    `${baseUrl(config)}/v1/reference-data/locations/hotels/by-city`,
  );
  hotelsUrl.searchParams.set("cityCode", input.destinationCode);
  hotelsUrl.searchParams.set("radius", "20");
  hotelsUrl.searchParams.set("radiusUnit", "KM");
  hotelsUrl.searchParams.set("hotelSource", "ALL");
  const hotels = hotelListResponseSchema.parse(
    await amadeusFetch(config, hotelsUrl),
  );
  const hotelIds = hotels.data.slice(0, 20).map((hotel) => hotel.hotelId);
  if (hotelIds.length === 0) {
    return {
      source: "Amadeus",
      environment: config.environment,
      query: input,
      offers: [],
    };
  }

  const offersUrl = new URL(`${baseUrl(config)}/v3/shopping/hotel-offers`);
  offersUrl.searchParams.set("hotelIds", hotelIds.join(","));
  offersUrl.searchParams.set("adults", String(input.adults));
  offersUrl.searchParams.set("checkInDate", input.checkInDate);
  offersUrl.searchParams.set("checkOutDate", input.checkOutDate);
  offersUrl.searchParams.set("roomQuantity", "1");
  offersUrl.searchParams.set("currency", "USD");
  offersUrl.searchParams.set("bestRateOnly", "true");
  const payload = hotelOffersResponseSchema.parse(
    await amadeusFetch(config, offersUrl),
  );
  const fetchedAt = new Date().toISOString();
  return {
    source: "Amadeus",
    environment: config.environment,
    query: input,
    offers: payload.data.flatMap((hotel) =>
      hotel.offers.slice(0, 1).map((offer) => ({
        id: offer.id,
        hotelId: hotel.hotel.hotelId,
        hotelName: hotel.hotel.name,
        checkInDate: offer.checkInDate,
        checkOutDate: offer.checkOutDate,
        totalPrice: Number.parseFloat(offer.price.total),
        currency: offer.price.currency,
        roomDescription: offer.room?.description?.text ?? null,
        source: "Amadeus" as const,
        fetchedAt,
        bookingSearchUrl: googleHotelsUrl(hotel.hotel.name, input),
        bookingLinkType: "SEARCH_LINK_NOT_CONFIRMED_FARE" as const,
      })),
    ),
  };
}

async function resolveRoute(
  config: AmadeusConfig,
  origin: string,
  destination: string,
): Promise<AirportRoute> {
  const [resolvedOrigin, resolvedDestination] = await Promise.all([
    resolveAirport(config, origin),
    resolveAirport(config, destination),
  ]);
  return {
    source: "Amadeus",
    origin: resolvedOrigin,
    destination: resolvedDestination,
  };
}

async function resolveAirport(
  config: AmadeusConfig,
  keyword: string,
): Promise<AirportRoute["origin"]> {
  const url = new URL(`${baseUrl(config)}/v1/reference-data/locations`);
  url.searchParams.set("subType", "CITY,AIRPORT");
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("view", "LIGHT");
  const payload = locationsResponseSchema.parse(
    await amadeusFetch(config, url),
  );
  const match =
    payload.data.find((item) => item.subType === "AIRPORT") ?? payload.data[0];
  if (!match) {
    throw new Error(`Amadeus could not resolve an airport for "${keyword}".`);
  }
  return {
    iataCode: match.iataCode,
    name: match.name,
    cityName: match.address.cityName,
    countryName: match.address.countryName,
  };
}

async function searchFlights(
  config: AmadeusConfig,
  input: {
    originLocationCode: string;
    destinationLocationCode: string;
    departureDate: string;
    returnDate?: string;
    adults: number;
    travelClass: string;
    nonStop: boolean;
    origin: AirportRoute["origin"];
    destination: AirportRoute["destination"];
  },
): Promise<FlightOfferSearch> {
  const url = new URL(`${baseUrl(config)}/v2/shopping/flight-offers`);
  url.searchParams.set("originLocationCode", input.originLocationCode);
  url.searchParams.set(
    "destinationLocationCode",
    input.destinationLocationCode,
  );
  url.searchParams.set("departureDate", input.departureDate);
  if (input.returnDate) url.searchParams.set("returnDate", input.returnDate);
  url.searchParams.set("adults", String(input.adults));
  url.searchParams.set("travelClass", input.travelClass);
  url.searchParams.set("nonStop", String(input.nonStop));
  url.searchParams.set("currencyCode", "USD");
  url.searchParams.set("max", "8");

  const payload = offersResponseSchema.parse(await amadeusFetch(config, url));
  const fetchedAt = new Date().toISOString();
  const offers = payload.data.map((offer) => {
    const itinerary = offer.itineraries[0];
    const segments = itinerary?.segments ?? [];
    return {
      id: offer.id,
      totalPrice: Number.parseFloat(offer.price.total),
      currency: offer.price.currency,
      validatingAirlines: offer.validatingAirlineCodes,
      seatsAvailable: offer.numberOfBookableSeats ?? null,
      stops: Math.max(0, segments.length - 1),
      duration: itinerary?.duration ?? "",
      segments: segments.map((segment) => ({
        departureAirport: segment.departure.iataCode,
        departureAt: segment.departure.at,
        arrivalAirport: segment.arrival.iataCode,
        arrivalAt: segment.arrival.at,
        carrierCode: segment.carrierCode,
        flightNumber: segment.number,
        duration: segment.duration,
      })),
      lastTicketingDate: offer.lastTicketingDate ?? null,
      source: "Amadeus" as const,
      fetchedAt,
      bookingSearchUrl: googleFlightsUrl(input),
      bookingLinkType: "SEARCH_LINK_NOT_CONFIRMED_FARE" as const,
    };
  });

  return {
    source: "Amadeus",
    environment: config.environment,
    query: {
      origin: input.origin,
      destination: input.destination,
      departureDate: input.departureDate,
      returnDate: input.returnDate ?? null,
      adults: input.adults,
      travelClass: input.travelClass,
      nonStop: input.nonStop,
    },
    offers,
  };
}

async function amadeusFetch(
  config: AmadeusConfig,
  url: URL,
): Promise<unknown> {
  const token = await getAccessToken(config);
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      "user-agent": "NEXUS/1.0 Amadeus MCP provider",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Amadeus request failed with HTTP ${response.status}: ${detail.slice(0, 300)}`,
    );
  }
  return response.json();
}

async function getAccessToken(config: AmadeusConfig): Promise<string> {
  if (
    cachedToken &&
    cachedToken.environment === config.environment &&
    cachedToken.expiresAt > Date.now() + 30_000
  ) {
    return cachedToken.value;
  }

  const response = await fetch(
    `${baseUrl(config)}/v1/security/oauth2/token`,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "NEXUS/1.0 Amadeus MCP provider",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId!,
        client_secret: config.clientSecret!,
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Amadeus authentication failed with HTTP ${response.status}.`,
    );
  }
  const token = tokenResponseSchema.parse(await response.json());
  cachedToken = {
    value: token.access_token,
    environment: config.environment,
    expiresAt: Date.now() + token.expires_in * 1000,
  };
  return token.access_token;
}

function baseUrl(config: AmadeusConfig): string {
  return config.environment === "production"
    ? "https://api.amadeus.com"
    : "https://test.api.amadeus.com";
}

function googleFlightsUrl(input: {
  originLocationCode: string;
  destinationLocationCode: string;
  departureDate: string;
  returnDate?: string;
}): string {
  const query = [
    `Flights from ${input.originLocationCode} to ${input.destinationLocationCode}`,
    `on ${input.departureDate}`,
    input.returnDate ? `returning ${input.returnDate}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
}

function googleHotelsUrl(
  hotelName: string,
  input: { checkInDate: string; checkOutDate: string },
): string {
  const query = `${hotelName} check in ${input.checkInDate} check out ${input.checkOutDate}`;
  return `https://www.google.com/travel/hotels?q=${encodeURIComponent(query)}`;
}

function readOnlyAnnotations() {
  return {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  };
}

function toolResult(data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

function routeShapeParse(value: unknown): AirportRoute {
  return routeSchema.parse(value);
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
