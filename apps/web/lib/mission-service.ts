import { PrismaClient } from "@prisma/client";
import {
  CostAnalysisAgent,
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
  WikimediaKnowledgeProvider,
  OpenStreetMapPlacesProvider,
  TavilyEvidenceProvider,
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

const mcpProviders = new MCPProviderRegistry([
  new AmadeusFlightProvider(),
  new TavilyEvidenceProvider(),
  new FrankfurterCurrencyProvider(),
  new OpenMeteoWeatherProvider(),
  new WikimediaKnowledgeProvider(),
  new OpenStreetMapPlacesProvider(),
]);
const researchAgent = new ResearchAgent(mcpProviders);

export const missionOrchestrator = new MissionOrchestrator(
  missionService,
  new MissionPlannerAgent(),
  researchAgent,
  new RecommendationAgent(),
  new CostAnalysisAgent(),
  new NotificationAgent(),
);
