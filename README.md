# NEXUS

**An autonomous mission agent built as an A2MCP Agent Service Provider for the
OKX.AI Genesis Hackathon.**

NEXUS is designed to be called by humans and other agents. It accepts a real-world
goal, creates a persistent mission, coordinates research and reasoning tools, and
returns an actionable plan with progress, recommendations, costs, and pending
human decisions.

```text
Goal -> Mission -> Research -> Planning -> Reasoning
     -> Recommendations -> Progress Tracking -> Mission Ready
```

NEXUS is not a general chatbot and the website is not the product. The primary
product is the callable agent service. The Next.js application is the operator
control plane for starting missions, inspecting agent activity, and reviewing
results.

## Agent Contract

NEXUS is being built toward an A2MCP invocation flow:

```json
{
  "goal": "Relocate to Canada for work",
  "missionType": "RELOCATE",
  "context": {
    "origin": "Nigeria",
    "targetDate": "2027-01"
  }
}
```

The agent creates a mission immediately, begins work with the information already
available, and asks only questions that materially affect the result.

```json
{
  "accepted": true,
  "missionId": "mission_...",
  "status": "ACTIVE",
  "progress": 20,
  "currentActivity": "Researching work permit pathways",
  "pendingQuestions": []
}
```

The public MCP service is live at:

```text
https://nexus-production-40fb.up.railway.app/api/mcp
```

The REST compatibility endpoint is:

```text
https://nexus-production-40fb.up.railway.app/api/a2mcp/mission
```

## What NEXUS Does

- Converts an open-ended goal into a persistent mission.
- Generates a different durable workflow for every mission type.
- Schedules resumable tasks with capability, status, blocking reason, and
  execution timestamps.
- Selects MCP providers by capability instead of hardcoded vendor names.
- Uses Tavily as the default source-preserving evidence provider for research
  capabilities such as immigration, jobs, universities, housing, healthcare,
  events, relocation, and freight.
- Continues missions through durable in-mission conversation, including
  preferences, follow-up research, and clear factual corrections.
- Enriches Tavily searches with bounded source extraction and an optional
  depth-one crawl for explicit deep-verification requests.
- Researches requirements, destinations, costs, weather, places, and documents.
- Ranks only provider-backed findings; missing evidence blocks recommendations.
- Builds budgets only from prices returned by providers.
- Computes progress from completed workflow tasks.
- Completes runnable work even when an optional capability is unavailable, then
  reports completed tasks, blocked tasks, evidence confidence, and unlock steps.
- Persists every operation in a mission timeline.
- Exposes mission state through a machine-readable agent contract.

## Safety Boundary

NEXUS never pays, books, transfers funds, signs transactions, or accesses
financial accounts. It researches and recommends. A human approves and performs
every consequential action.

## Architecture

```text
A2MCP Caller
    |
    v
Mission Orchestrator
    |
    +-- Mission Planner
    +-- Research Agent ------> MCP Provider Registry
    +-- Reasoning Agent              |
    +-- Recommendation Agent         +-- Search / Weather / Maps / Places
    +-- Cost Analysis Agent          +-- Calendar / Email / Documents
    +-- Memory Agent                 +-- Travel / Accommodation
    +-- Notification Agent
    |
    v
Mission Engine ------> Prisma Repository ------> SQLite
```

Every internal agent implements one exported `Agent` interface. Every external
tool integration implements one `MCPProvider` interface and is registered by
capability, keeping providers swappable.

## Repository

- `apps/web` - secondary Mission Control and operator dashboard
- `packages/mission-engine` - mission lifecycle, progress, and persistence
- `packages/agents` - agent contract and internal agent modules
- `packages/mcp-adapters` - capability-based MCP provider abstraction
- `packages/shared` - shared mission and A2MCP contracts
- `docs/a2mcp-contract.md` - protocol direction and service boundaries
- `docs/decisions.md` - architecture decisions and rationale
- `docs/mission-schema.md` - mission domain model

## Current Status

The current architecture includes:

- pnpm monorepo and Next.js operator control plane
- shared mission domain model
- Prisma and SQLite persistence behind a repository interface
- create, read, update, lifecycle transition, and progress operations
- lifecycle tests for `DRAFT -> ACTIVE -> READY`
- executable create/fetch verification script
- `POST /api/a2mcp/mission` for persistent mission creation and resume
- direct route-handler tests for create, resume, and invalid input
- Mission Orchestrator and Research Agent behind the A2MCP endpoint
- official MCP TypeScript SDK client/server tool invocation
- live Open-Meteo destination weather research
- persisted research results returned on create and resume
- mission-specific workflow definitions for all nine mission types
- resumable workflow scheduling with blocked/failed/completed task states
- provider/task provenance and source URLs on stored evidence
- evidence-only recommendations and budgets with no deterministic allowances
- persisted mission execution timeline
- optional Amadeus flight, airport, and hotel adapter, registered only when
  credentials are configured
- Open-Meteo dated forecasts
- OpenStreetMap destination and local-transport evidence
- REST Countries country/currency resolution plus Frankfurter exchange-rate
  evidence, including free-text country, city, and state inputs
- Tavily source-preserving research with evidence-grounded synthesized answers
  and confidence scores
- capability-specific Tavily queries and mission-domain exclusions
- at most three distinct, on-topic, synthesized recommendations
- durable USER/AGENT conversation returned through REST and MCP
- natural setup-answer continuation and fact correction without duplicating a
  mission
- Tavily Search plus top-three Extract enrichment, with bounded Crawl for
  explicit deep research
- persisted, idempotent orchestration notifications
- verified free OKX.AI A2MCP behavior with direct HTTP `200`
- outward-facing MCP Streamable HTTP `nexus_mission` tool
- documented marketplace identity, validation, review, and activation gates
- Railway production deployment with volume-backed SQLite persistence
- public HTTPS health, REST, and MCP endpoints verified end to end
- immutable production image published through GitHub Container Registry

## Local Development

Requires Node.js 20+ and pnpm.

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm mission:verify
pnpm dev
```

`pnpm mission:verify` synchronizes the local SQLite schema, creates a mission, and
fetches it through the Mission Engine.

## Hackathon

NEXUS is being developed for the **OKX.AI Genesis Hackathon** as an Agent Service
Provider. The free A2MCP service is deployed and verified. Marketplace
registration, review, and activation remain pending through the official
Agentic Wallet workflow recorded in `docs/decisions.md`.

## License

License selection is pending.
