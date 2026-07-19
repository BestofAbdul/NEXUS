# NEXUS - Autonomous Mission Agent

This file is the standing instruction set for this repository.

## Product boundary

NEXUS is an A2MCP autonomous mission agent and mission operating system, not a
chatbot or a conventional web application:

```text
Goal -> Mission -> Research -> Planning -> Reasoning -> Recommendations
-> Progress Tracking -> Mission Ready
```

NEXUS never pays, books, or touches financial accounts. It recommends; the human
approves and acts.

The callable Agent Service Provider is the primary product surface. The Next.js
application is a secondary operator control plane for mission creation,
observability, and review.

## Fixed technical decisions

- TypeScript on Node.js 20+
- Next.js App Router, React, and Tailwind CSS
- Next.js API routes, unless Phase 1 records a decision to use `/server`
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

- NEXUS must expose a machine-readable invocation contract for other agents.
- Agent calls create or resume persistent missions rather than isolated chats.
- Responses surface mission ID, status, progress, current activity, results, and
  any genuinely blocking human question.
- Do not invent OKX.AI manifest, authentication, or listing formats. Verify them
  against current official documentation before implementation.

## Operator UI rules

- The UI is a secondary control plane, not the primary product.
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

Complete one phase at a time. Each phase must run and meet its definition of done.
Stop after every phase and wait for explicit approval before starting the next.

### Phase 0 - Scaffolding

- Create the prescribed repository structure.
- Initialize the Next.js app and empty packages.
- Make `pnpm install` and `pnpm build` succeed.
- Render a placeholder Mission Control page.

### Phase 1 - Domain model and Mission Engine

- Define and document mission domain types in `packages/shared`.
- Implement create, read, update, persistence, and progress calculation.
- Add lifecycle transition tests for draft to active to ready.

### Phase 2 - Mission Control and setup

- Build Mission Control and a Travel mission setup flow.
- Persist the mission and list it under Active Missions.

### Phase 3 - Agent and MCP vertical slice

- Implement the Agent interface, Orchestrator, Research Agent, and one real MCP
  provider.
- Show live activity and a real result on the Mission Dashboard.

### Phase 4 - Agents, costs, and OKX ASP

- Add Recommendation, Cost Analysis, and Notification agents.
- Implement the verified OKX.AI ASP contract.

### Phase 5 - Demo readiness

- Add states, in-mission conversation, and a demo script.
- Preserve the no-payment and no-booking boundary.

## Working agreement

- Do not substitute the stack, layout, or agent boundaries silently.
- Cut scope instead of skipping phases or verification.
- End every phase with working software.
- Record every non-trivial architectural choice in `docs/decisions.md`.
