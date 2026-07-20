# NEXUS A2MCP Contract

NEXUS is being built as an Agent Service Provider for OKX.AI. This document
defines the product-level contract while deliberately leaving platform-specific
manifest, authentication, and transport fields pending official verification.

## Service Identity

- **Name:** NEXUS
- **Category:** Autonomous mission planning and coordination
- **Primary caller:** Humans or agents with a real-world goal
- **Primary output:** A persistent mission with status, research, tasks,
  recommendations, costs, and pending decisions

## Invocation Semantics

An invocation creates a new mission or continues an existing mission.

```http
POST /api/a2mcp/mission
Content-Type: application/json
```

```ts
interface A2MCPMissionRequest {
  goal: string;
  missionType?: MissionType;
  missionId?: string;
  context?: Record<string, string>;
}
```

NEXUS begins useful work immediately. It asks a question only when the missing
answer materially changes the research path, recommendation, cost, or safety of
the mission.

```ts
interface A2MCPMissionResponse {
  accepted: boolean;
  missionId: string;
  status: "DRAFT" | "ACTIVE" | "READY";
  progress: number;
  currentActivity: string;
  pendingQuestions: string[];
  results: A2MCPMissionResult[];
}
```

Successful creation returns HTTP `201`. Resuming an existing mission returns
HTTP `200` with the same `missionId`.

For Travel missions with a resolvable destination, Phase 3 runs the Research
Agent through the registered weather MCP provider. `currentActivity` summarizes
the actual observation and `results` contains the persisted provider output:

```json
{
  "providerId": "open-meteo-weather",
  "capability": "weather",
  "summary": "Weather in Tokyo, Japan: ...",
  "data": {
    "source": "Open-Meteo",
    "temperatureC": 25.2,
    "observedAt": "2026-07-21T07:00",
    "mcp": {
      "protocol": "MCP",
      "serverName": "nexus-open-meteo-weather",
      "tool": "get_current_weather"
    }
  }
}
```

Each resume invocation runs orchestration again. If the mission already has a
persisted weather result, the orchestrator returns that real evidence without
duplicating the mission, repeating the external request, or inserting a duplicate
result.

Invalid caller input returns HTTP `400`:

```json
{
  "error": {
    "code": "INVALID_GOAL",
    "message": "goal is required and must be a non-empty string."
  }
}
```

An unknown `missionId` returns HTTP `404` with `MISSION_NOT_FOUND`. Unexpected
service failures return a generic `500` response without exposing internal
details.

## Execution Model

1. Validate the request and resolve or create a mission.
2. Persist the mission independently of the calling conversation.
3. Ask the Mission Orchestrator to choose the next internal agent.
4. Resolve external tools through the MCP provider registry by capability.
5. Call the selected provider through the official MCP client.
6. Persist research, tasks, recommendations, costs, and timeline events.
7. Return machine-readable status and any blocking human question.
8. Continue until the mission reaches `READY` or requires human input.

## Hard Safety Boundary

NEXUS can research prices, produce cost estimates, and recommend an action. It
must never:

- initiate or approve a payment;
- book travel, accommodation, appointments, or services;
- access a wallet, bank, exchange, or financial account;
- sign a transaction or accept contractual terms;
- represent a recommendation as a completed human action.

## Platform Fields Pending Verification

Before implementing the public ASP endpoint, verify and document the current
official OKX.AI requirements for:

- transport and endpoint shape;
- authentication and request signing;
- service manifest and capability declaration;
- streaming, callbacks, or polling;
- health checks and review criteria;
- marketplace listing metadata.

The verified fields will be recorded in `docs/decisions.md` under
"OKX ASP integration."
