# @nexus/agents

The single responsibility of this package is to expose the common A2MCP-aligned
`Agent` contract, NEXUS internal agents, and the mission orchestration boundary.

Agents operate on persistent mission state and return machine-readable results;
they do not own UI or persistence implementation details.
