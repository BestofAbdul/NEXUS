# @nexus/agents

The single responsibility of this package is to expose the common A2MCP-aligned
`Agent` contract, NEXUS internal agents, and the mission orchestration boundary.

Agents operate on persistent mission state and return machine-readable results;
they do not own UI or persistence implementation details.

The implemented flow includes:

- mission-specific workflow definitions with separate Travel, Relocate, Study,
  Property, Job, Event, Medical, Freight, and Custom capability sequences;
- `MissionPlannerAgent`, which turns the selected definition into durable,
  ordered workflow tasks;
- `ResearchAgent`, which selects weather, nearby-place, or knowledge-search MCP
  capabilities plus airport resolution and flight offers, and converts provider
  output into mission evidence;
- `MissionOrchestrator`, which schedules and resumes tasks, persists timeline
  operations, stores task-owned evidence, retries blocked providers, and moves a
  mission to READY only when required tasks complete;
- `RecommendationAgent`, which ranks comparable persisted evidence and blocks
  when no evidence exists;
- `CostAnalysisAgent`, which extracts only provider-returned prices and never
  creates planning allowances;
- `NotificationAgent`, which persists completed orchestration stages.
