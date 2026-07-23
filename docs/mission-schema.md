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
workflow execution is running or waiting for required user input. `READY` means
all currently runnable work reached a terminal state. A READY mission may still
contain clearly reported `BLOCKED` or `FAILED` tasks when an optional provider
is unavailable; a resume retries those tasks without duplicating the mission.

## Task

A task belongs to one mission and has `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`,
`FAILED`, or `COMPLETED` status. Each task stores a stable workflow key,
capability, description, sequence, required/optional flag, blocking reason, and
execution timestamps. Progress is the percentage of all workflow tasks that are
actually `COMPLETED`; blocked and failed tasks never inflate progress.

## Recommendation

A ranked, actionable suggestion produced by an agent. It retains a concise
summary and rationale, but never performs payments, bookings, or financial
account operations.

## CostEstimate

A mission budget line item: category, numeric amount, currency, and optional
notes. It is informational only and never authorizes a financial action.

## MissionNotification

An immutable, mission-owned status update emitted by the Notification Agent
after a real orchestration stage completes. Unique mission/message storage keeps
resume invocations idempotent.

## TimelineEntry

An immutable event in mission history. Events now include mission/workflow
creation, task start/completion/block/failure, evidence storage, recommendation
generation, user waits, lifecycle changes, and notes.

## MissionResearchResult

An evidence record produced through an MCP/API provider. It belongs to a stable
workflow task and stores provider ID, capability, evidence-grounded summary,
confidence score, structured data, source URLs, retrieval time, and creation
time. New results are upserted by
mission/task key so a resumed task refreshes evidence without duplication.

Phase 3 persists live weather observations here, including Open-Meteo source
fields and MCP server/tool metadata. Resume invocations reuse existing evidence
until new research is explicitly needed, rather than replacing mission state or
creating duplicate missions or results.

Recommendations and cost estimates remain separate mission-owned records, but
they can now be created only from persisted evidence. If comparable evidence or
provider-backed prices are missing, the corresponding workflow task is BLOCKED
and NEXUS returns no template recommendation or assumed budget. The A2MCP
execution summary lists completed, blocked, and failed tasks; evidence and
confidence; and pending actions required to unlock unavailable capabilities.
