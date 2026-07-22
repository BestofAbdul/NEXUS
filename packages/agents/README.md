# @nexus/agents

The single responsibility of this package is to expose the common A2MCP-aligned
`Agent` contract, NEXUS internal agents, and the mission orchestration boundary.

Agents operate on persistent mission state and return machine-readable results;
they do not own UI or persistence implementation details.

The implemented flow includes:

- `MissionPlannerAgent`, which interprets each mission type, goal, and submitted
  preference into focus areas and persisted next-action tasks;
- `ResearchAgent`, which selects weather, nearby-place, or knowledge-search MCP
  capabilities and converts provider output into mission evidence;
- `MissionOrchestrator`, which runs research, persists results through the
  Mission Engine, and returns current activity to the A2MCP route;
- `RecommendationAgent`, which uses mission-specific logic and caller context
  to produce ranked actions for all nine mission types;
- `CostAnalysisAgent`, which creates type-aware informational budget line items
  only;
- `NotificationAgent`, which persists completed orchestration stages.
