# NEXUS - Autonomous Mission Agent

This file is the standing instruction set for this repository. It supersedes
the previous phase plan — the product direction is now confirmed and the
remaining phases are re-scoped around it. Do not revert to a UI-first plan.

## Product boundary

NEXUS is an A2MCP autonomous mission agent and mission operating system, not a
chatbot or a conventional web application:

```text
Goal -> Mission -> Research -> Planning -> Reasoning -> Recommendations
-> Progress Tracking -> Mission Ready
```

NEXUS never pays, books, or touches financial accounts. It recommends; the human
approves and acts.

**Confirmed:** the callable Agent Service Provider (the A2MCP invocation
endpoint) is the primary product surface, because that's what OKX.AI judges.
The Next.js application is a secondary operator control plane — useful for a
demo, but it must not gate or duplicate business logic. The API and the UI both
call the same Mission Engine; the UI never becomes a second source of truth.

## Fixed technical decisions

- TypeScript on Node.js 20+
- Next.js App Router, React, and Tailwind CSS
- Next.js API routes, unless a documented decision says otherwise
- SQLite through Prisma for local and hackathon scope
- Official MCP TypeScript SDK
- pnpm

OKX.AI ASP technical requirements take precedence if they conflict with these
decisions.

## Repository structure

```text
/apps/web
/packages/mission-engine
/packages/agents
/packages/mcp-adapters
/packages/shared
/docs/decisions.md
/docs/mission-schema.md
/docs/a2mcp-contract.md
```

Packages communicate only through exported interfaces. Every package has a
README describing its single responsibility.

## Internal agents

All agents implement a common `Agent` interface with
`run(input): Promise<AgentResult>`.

- Mission Planner
- Research Agent
- Reasoning Agent
- Recommendation Agent
- Cost Analysis Agent
- Conversation Agent
- Memory Agent
- Notification Agent
- Mission Orchestrator

## MCP abstraction

MCP providers are registered behind a shared provider interface. Agent logic asks
for capabilities and never hardcodes a named provider.

## A2MCP service boundary

- NEXUS must expose a machine-readable invocation contract for other agents,
  per `docs/a2mcp-contract.md` (`A2MCPMissionRequest` / `A2MCPMissionResponse`).
- Agent calls create or resume persistent missions rather than isolated chats —
  calling with an existing `missionId` must continue that mission, never create
  a duplicate.
- Responses surface mission ID, status, progress, current activity, results, and
  any genuinely blocking human question (`pendingQuestions`).
- Do not invent OKX.AI manifest, authentication, or listing formats. Verify them
  against current official documentation before implementation (Phase 4).

## Operator UI rules (secondary surface — build after the API works)

- The UI reads and triggers through the same API contract; it does not
  reimplement mission logic.
- Home is Mission Control, never a marketing-only landing page or bare chat box.
- Mission setup asks for the minimum information and starts research immediately.
- The Mission Dashboard surfaces progress, activity, recommendations, budget,
  tasks, decisions, conversation, notifications, and documents.
- Copy states what NEXUS is doing and why before asking a question.
- The interface is minimal, modern, and mission-focused.

## OKX.AI integration

Before Phase 4, verify current ASP API, authentication, manifest, and listing
requirements using official OKX.AI documentation. Record findings in
`docs/decisions.md` before implementation.

## Phased execution

Complete one phase at a time. Each phase must run and meet its definition of
done. Stop after every phase and wait for explicit approval before starting the
next. Do not reorder phases without flagging it first.

### Phase 0 - Scaffolding — DONE, verified
### Phase 1 - Domain model and Mission Engine — DONE, verified

### Phase 2 - A2MCP invocation endpoint (replaces the old UI-first Phase 2)

- Implement `POST /api/a2mcp/mission` in `apps/web`, matching
  `A2MCPMissionRequest` / `A2MCPMissionResponse` from `docs/a2mcp-contract.md`
  exactly.
- A request with no `missionId` creates a new mission via the Mission Engine
  (`DRAFT` → `ACTIVE`). A request with an existing `missionId` resumes that
  mission — it must never create a duplicate.
- `currentActivity` can be a static placeholder string at this stage (e.g.
  `"Mission created, awaiting orchestration"`) since no agent runs yet.
  `pendingQuestions` returns `[]` until Phase 3 adds real question logic.
- Validate the request: reject a missing `goal`, reject an invalid
  `missionType`, return a clear error shape (not a 500) on bad input.
- Automated test hitting the route handler directly (not just unit-testing the
  engine) for: create, resume, and invalid-input cases.
- **DoD:** `curl -X POST /api/a2mcp/mission -d '{"goal": "..."}'` returns a real
  persisted mission id and a valid `A2MCPMissionResponse`; POSTing again with
  that `missionId` continues it rather than duplicating it.

### Phase 3 - Orchestrator + Research Agent + one real MCP provider

- Implement the `Agent` interface and Mission Orchestrator.
- Wire the Research Agent to one real MCP provider (pick the simplest, e.g.
  weather).
- The orchestrator runs when a mission is created or resumed; progress and
  `currentActivity` in the API response must reflect real state, not a mock
  (e.g. `"Checking weather for Tokyo"` → a stored result, not a canned string).
- **DoD:** invoking the endpoint with a Travel goal triggers a real MCP call,
  and a follow-up request with the same `missionId` shows a real result
  persisted on the mission.

### Phase 4 - Remaining agents, costs, and OKX ASP integration

- Add Recommendation, Cost Analysis, and Notification agents to the
  orchestrator's flow.
- Implement the verified OKX.AI ASP manifest/listing contract around the
  Phase 2 endpoint — do not guess the format; confirm it first per the OKX.AI
  integration section above.
- **DoD:** a full mission invocation returns recommendations and a cost
  breakdown through the API, and the service satisfies OKX's ASP technical
  requirement.

### Phase 4.5 - Minimal operator UI (optional but recommended for the demo)

- Thin Mission Control + Mission Dashboard that call the Phase 2–4 API — no
  business logic lives in the UI layer.
- Scope to what a live demo needs: pick a mission type, submit, watch status
  update, see the result. Cut mission types before cutting this if time is
  short — a working single-path demo beats nine half-built ones.
- **DoD:** a person can watch a mission go from submitted to ready in the
  browser, backed entirely by real API calls.

### Phase 5 - Demo readiness

- Add empty/error states, in-mission conversation through the Conversation
  Agent, and a demo script (including the machine-to-machine invocation, since
  that's what's actually being judged).
- Reconfirm the no-payment and no-booking boundary holds end to end.
- Prepare the public walkthrough post required for hackathon submission.

## Working agreement

- Do not substitute the stack, layout, or agent boundaries silently.
- Cut scope instead of skipping phases or verification.
- End every phase with working software, verified by actually running it —
  not just asserting the phase is complete.
- Record every non-trivial architectural choice in `docs/decisions.md`.
- Before referencing anything outside this repo (e.g. a prior prototype), confirm
  it actually exists in this workspace — don't carry forward assumptions from a
  different project or session.
