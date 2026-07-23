import assert from "node:assert/strict";
import test from "node:test";
import type { Task } from "@nexus/shared";
import {
  assertMissionTransition,
  calculateMissionProgress,
} from "../src/lifecycle";

const task = (status: Task["status"]): Pick<Task, "status"> => ({ status });

test("allows the draft to active to ready mission lifecycle", () => {
  assert.doesNotThrow(() => assertMissionTransition("DRAFT", "ACTIVE"));
  assert.doesNotThrow(() => assertMissionTransition("ACTIVE", "READY"));
  assert.doesNotThrow(() => assertMissionTransition("READY", "ACTIVE"));
});

test("rejects lifecycle transitions that skip or reverse mission states", () => {
  assert.throws(() => assertMissionTransition("DRAFT", "READY"));
  assert.throws(() => assertMissionTransition("READY", "DRAFT"));
});

test("computes progress from completed tasks even for partially ready missions", () => {
  assert.equal(
    calculateMissionProgress("ACTIVE", [
      task("COMPLETED"),
      task("NOT_STARTED"),
    ]),
    50,
  );
  assert.equal(calculateMissionProgress("ACTIVE", []), 0);
  assert.equal(calculateMissionProgress("READY", [task("NOT_STARTED")]), 0);
  assert.equal(
    calculateMissionProgress("READY", [
      task("COMPLETED"),
      task("BLOCKED"),
      task("COMPLETED"),
    ]),
    67,
  );
});
