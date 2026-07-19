# Mission Schema

The authoritative TypeScript contracts are exported by
`@nexus/shared` (`packages/shared/src/index.ts`). This document records their
domain meaning.

## Mission

A persistent unit of work created from a user goal. It contains a `title`,
`type`, original `goal`, minimal `setupAnswers`, lifecycle `status`, task list,
and derived `progress`.

`MissionType` is one of `TRAVEL`, `RELOCATE`, `STUDY_ABROAD`,
`BUY_RENT_PROPERTY`, `NEW_JOB`, `PLAN_EVENT`, `MEDICAL_TRIP`, `MOVE_GOODS`, or
`CUSTOM`.

`MissionStatus` follows an intentionally simple forward-only lifecycle:

```text
DRAFT -> ACTIVE -> READY
```

`DRAFT` means the record exists but has not started execution. `ACTIVE` means
research and planning may proceed. `READY` means the mission has completed its
planned work. A ready mission reports `100` percent progress; otherwise progress
is the percentage of completed tasks.

## Task

A task belongs to one mission and has `NOT_STARTED`, `IN_PROGRESS`, or
`COMPLETED` status. Tasks are the Phase 1 input to progress calculation.

## Recommendation

A ranked, actionable suggestion produced by an agent. It retains a concise
summary and rationale, but never performs payments, bookings, or financial
account operations.

## CostEstimate

A mission budget line item: category, numeric amount, currency, and optional
notes. It is informational only and never authorizes a financial action.

## TimelineEntry

An immutable event in mission history. The current event kinds are mission
creation, lifecycle changes, task completion, and notes.
