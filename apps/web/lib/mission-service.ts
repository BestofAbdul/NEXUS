import { PrismaClient } from "@prisma/client";
import {
  MissionService,
  PrismaMissionRepository,
} from "@nexus/mission-engine";

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
