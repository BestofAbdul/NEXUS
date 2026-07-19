import assert from "node:assert/strict";
import test from "node:test";
import type { Task } from "@nexus/shared";
import {
  assertMissionTransition,
  calculateMissionProgress,
} from "../src/lifecycle.js";

const task = (status: Task["status"]): Pick<Task, "status"> => ({ status });

test("allows the draft to active to ready mission lifecycle", () => {
  assert.doesNotThrow(() => assertMissionTransition("DRAFT", "ACTIVE"));
  assert.doesNotThrow(() => assertMissionTransition("ACTIVE", "READY"));
});

test("rejects lifecycle transitions that skip or reverse mission states", () => {
  assert.throws(() => assertMissionTransition("DRAFT", "READY"));
  assert.throws(() => assertMissionTransition("READY", "ACTIVE"));
});

test("computes progress from completed tasks and completes ready missions", () => {
  assert.equal(
    calculateMissionProgress("ACTIVE", [
      task("COMPLETED"),
      task("NOT_STARTED"),
    ]),
    50,
  );
  assert.equal(calculateMissionProgress("ACTIVE", []), 0);
  assert.equal(calculateMissionProgress("READY", [task("NOT_STARTED")]), 100);
});
