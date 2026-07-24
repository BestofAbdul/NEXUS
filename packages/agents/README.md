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
- `ResearchAgent`, which resolves providers by capability, uses Tavily as the
  default evidence source for broad research, enriches searches with bounded
  Extract/Crawl calls, and treats flight, airport, and hotel providers as
  optional capabilities;
- `ConversationAgent`, which turns clear replies into persisted setup updates
  or focused source-backed follow-up research while asking only still-blocking
  questions;
- `MissionOrchestrator`, which schedules and resumes tasks, persists timeline
  operations, stores task-owned evidence, retries blocked providers, and moves a
  mission to READY when every task has reached a terminal state, including
  explicitly blocked capabilities that can be unlocked later;
- `RecommendationAgent`, which ranks comparable persisted evidence and blocks
  when no evidence exists; item-shaped evidence is filtered against mission
  topic terms, deduplicated, synthesized, and capped at three;
- `CostAnalysisAgent`, which extracts only provider-returned prices and never
  creates planning allowances;
- `NotificationAgent`, which persists completed orchestration stages.
