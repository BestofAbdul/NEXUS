# @nexus/agents

The single responsibility of this package is to expose the common A2MCP-aligned
`Agent` contract, NEXUS internal agents, and the mission orchestration boundary.

Agents operate on persistent mission state and return machine-readable results;
they do not own UI or persistence implementation details.

The implemented flow includes:

- `ResearchAgent`, which selects the weather capability and converts the MCP
  result into mission research;
- `MissionOrchestrator`, which runs research, persists results through the
  Mission Engine, and returns current activity to the A2MCP route;
- `RecommendationAgent`, which turns persisted evidence into ranked actions;
- `CostAnalysisAgent`, which creates informational budget line items only;
- `NotificationAgent`, which persists completed orchestration stages.
