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

The primary interoperable transport is an MCP Streamable HTTP endpoint:

```http
POST /api/mcp
```

It exposes the `nexus_mission` tool with the request fields below. The REST route
remains a thin compatibility adapter and delegates to the same application
service:

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
  action?: {
    type: "EXPLORE_RECOMMENDATION";
    recommendationId: string;
    query?: string;
  };
}
```

NEXUS begins useful work immediately. It asks a question only when the missing
answer materially changes the research path, recommendation, cost, or safety of
the mission. Travel currently requires `origin`, `destination`, and an ISO
`departureDate`. A country-only destination is not treated as sufficient for
flight search; the response asks for a city or airport.

```ts
interface A2MCPMissionResponse {
  accepted: boolean;
  missionId: string;
  missionType: MissionType;
  status: "DRAFT" | "ACTIVE" | "READY";
  progress: number;
  currentActivity: string;
  pendingQuestions: string[];
  results: A2MCPMissionResult[];
  recommendations: A2MCPRecommendation[];
  costBreakdown: A2MCPCostBreakdown;
  tasks: A2MCPTask[];
  notifications: A2MCPNotification[];
  timeline: A2MCPTimelineEntry[];
  executionSummary: {
    completedTasks: A2MCPExecutionTaskSummary[];
    blockedTasks: A2MCPBlockedTaskSummary[];
    failedTasks: A2MCPBlockedTaskSummary[];
    evidenceCollected: A2MCPEvidenceSummary[];
    averageConfidence: number | null;
    pendingActions: string[];
  };
}
```

Successful creation and resume both return HTTP `200`, as required for a free
OKX.AI A2MCP service. Resume returns the same `missionId`.

Once blocking facts are present, every mission creates its mission-specific
ordered workflow and schedules durable tasks. Each task moves through
`NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `FAILED`, or `COMPLETED`; progress is
computed from completed tasks. Travel requests Open-Meteo weather for the
selected date, uses OpenStreetMap for nearby places and transportation, and uses
Frankfurter plus location/country resolution for currency evidence. Broad
research capabilities use Tavily by default and preserve its synthesized answer,
source excerpts, URLs, and confidence score.

Amadeus is an optional provider for `airports`, `flights`, and `hotels`; it is
registered only when both credentials exist. If no flight provider is
registered, the flight task is `BLOCKED` with the exact reason
`No flight provider configured`. Independent research continues, and the mission
can reach `READY` with partial progress plus explicit pending actions.
Dates outside Open-Meteo's forecast horizon return `OUT_OF_RANGE`; current
weather is never substituted for a future date.

```json
{
  "providerId": "amadeus-flight-offers",
  "capability": "flights",
  "summary": "Amadeus returned 8 live offer(s) from LOS to JFK...",
  "data": {
    "source": "Amadeus",
    "offers": [
      {
        "totalPrice": 1042.31,
        "currency": "USD",
        "segments": [],
        "bookingSearchUrl": "https://www.google.com/travel/flights?...",
        "bookingLinkType": "SEARCH_LINK_NOT_CONFIRMED_FARE"
      }
    ]
  }
}
```

The external URL is a route search link, not a promise that the returned
Amadeus fare can be booked at that URL. The human must verify the final fare
with an airline or booking service; NEXUS never books or pays.

Weather evidence is date-specific:

```json
{
  "providerId": "open-meteo-weather",
  "capability": "weather",
  "summary": "Open-Meteo forecast for New York on 2026-07-25...",
  "data": {
    "source": "Open-Meteo",
    "requestedDate": "2026-07-25",
    "status": "FORECAST",
    "forecast": {
      "temperatureMaxC": 28.1,
      "temperatureMinC": 21.4
    },
    "mcp": {
      "protocol": "MCP",
      "serverName": "nexus-open-meteo-weather",
      "tool": "get_weather_forecast"
    }
  }
}
```

Resume merges new `context` into the persisted mission. If answers or an
exploration action change, NEXUS reopens a READY mission, clears stale derived
output, recreates the same workflow, and reruns research for the same
`missionId`. A plain resume retries blocked tasks and upserts task-owned evidence
without duplicating the mission, tasks, or results.

`READY` is a terminal execution state, not a claim that every optional provider
was available. The response's `executionSummary` is the canonical compact view
of completed work, blocked or failed capabilities, collected evidence,
confidence, and caller actions that can unlock more work.

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

## OKX.AI Service Form

NEXUS uses the verified free A2MCP service form: a public HTTPS endpoint that
returns its JSON result directly with HTTP `200`, with listing fee `"0"`.
Official documentation currently defines no repository manifest or free-service
request signing scheme, so neither is invented here. Marketplace identity,
validation, review, and activation requirements are recorded in
`docs/decisions.md`.
