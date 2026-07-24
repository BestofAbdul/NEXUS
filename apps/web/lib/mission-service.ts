import { PrismaClient } from "@prisma/client";
import {
  CostAnalysisAgent,
  ConversationAgent,
  MissionPlannerAgent,
  MissionOrchestrator,
  NotificationAgent,
  RecommendationAgent,
  ResearchAgent,
} from "@nexus/agents";
import {
  MCPProviderRegistry,
  AmadeusFlightProvider,
  FrankfurterCurrencyProvider,
  OpenMeteoWeatherProvider,
  RestCountriesProvider,
  WikimediaKnowledgeProvider,
  OpenStreetMapPlacesProvider,
  TavilyEvidenceProvider,
  type MCPProvider,
} from "@nexus/mcp-adapters";
import {
  MissionService,
  PrismaMissionRepository,
} from "@nexus/mission-engine";

process.env.DATABASE_URL ??= "file:./dev.db";

const globalForPrisma = globalThis as typeof globalThis & {
  nexusPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.nexusPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.nexusPrisma = prisma;
}

export const missionService = new MissionService(
  new PrismaMissionRepository(prisma),
);

const configuredProviders: MCPProvider[] = [
  new TavilyEvidenceProvider(),
  new FrankfurterCurrencyProvider(),
  new RestCountriesProvider(),
  new OpenMeteoWeatherProvider(),
  new WikimediaKnowledgeProvider(),
  new OpenStreetMapPlacesProvider(),
];

if (
  process.env.AMADEUS_CLIENT_ID?.trim() &&
  process.env.AMADEUS_CLIENT_SECRET?.trim()
) {
  configuredProviders.push(new AmadeusFlightProvider());
}

const mcpProviders = new MCPProviderRegistry(configuredProviders);
const researchAgent = new ResearchAgent(mcpProviders);

export const missionOrchestrator = new MissionOrchestrator(
  missionService,
  new MissionPlannerAgent(),
  researchAgent,
  new RecommendationAgent(),
  new CostAnalysisAgent(),
  new NotificationAgent(),
  new ConversationAgent(),
);
