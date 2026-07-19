import { PrismaClient } from "@prisma/client";
import {
  MissionService,
  PrismaMissionRepository,
} from "../src/index.js";

const prisma = new PrismaClient();
const service = new MissionService(new PrismaMissionRepository(prisma));

try {
  const mission = await service.createMission({
    title: "Verify a Toronto work trip",
    type: "TRAVEL",
    goal: "Plan a five-day work trip to Toronto.",
    setupAnswers: {
      destination: "Toronto",
      purpose: "Work",
      travelDate: "2026-09-12",
    },
  });

  const fetchedMission = await service.getMission(mission.id);
  if (!fetchedMission || fetchedMission.id !== mission.id) {
    throw new Error("Mission could not be fetched after creation.");
  }

  console.log(
    JSON.stringify(
      {
        id: fetchedMission.id,
        title: fetchedMission.title,
        status: fetchedMission.status,
        progress: fetchedMission.progress,
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
