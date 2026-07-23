import type { MissionStatus, Task } from "@nexus/shared";

const transitions: Record<MissionStatus, readonly MissionStatus[]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["READY"],
  READY: ["ACTIVE"],
};

export function canTransitionMission(
  from: MissionStatus,
  to: MissionStatus,
): boolean {
  return transitions[from].includes(to);
}

export function assertMissionTransition(
  from: MissionStatus,
  to: MissionStatus,
): void {
  if (!canTransitionMission(from, to)) {
    throw new Error(`Invalid mission status transition: ${from} -> ${to}`);
  }
}

export function calculateMissionProgress(
  _status: MissionStatus,
  tasks: readonly Pick<Task, "status">[],
): number {
  if (tasks.length === 0) {
    return 0;
  }

  const completedTasks = tasks.filter((task) => task.status === "COMPLETED").length;
  return Math.round((completedTasks / tasks.length) * 100);
}
