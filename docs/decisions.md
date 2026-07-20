# Architecture Decisions

This log records non-trivial technical choices and their rationale.

## 2026-07-19 - pnpm workspace without an additional task runner

**Decision:** Use pnpm workspace filtering and recursive scripts for the initial
monorepo.

**Rationale:** Phase 0 has one buildable app and empty boundary packages, so adding
a task-runner dependency would introduce complexity without improving the current
build. This can be revisited when package build graphs become meaningful.

## 2026-07-19 - Preserve the pre-existing AgentHub prototype

**Decision:** Keep `agenthub/` unchanged and exclude it from the NEXUS workspace.

**Rationale:** It implements a different product direction. Preserving it avoids
destroying prior work while giving NEXUS the fixed repository shape required by
the build instructions.

**2026-07-20 audit:** The folder exists locally at the repository root and is
ignored by Git. It has never been tracked and no `agenthub/` object or path
exists in NEXUS Git history. This entry documents preservation of local,
out-of-repository work only; NEXUS does not depend on it.

## 2026-07-19 - Start with Next.js API routes, no separate server

**Decision:** Keep the backend in Next.js API routes for the current mission
lifecycle scope; do not add `/server` in Phase 1.

**Rationale:** Creating, reading, updating, and transitioning a mission are
short-lived operations. A separate process becomes justified only when the agent
orchestrator needs durable background execution, which is outside this phase.

## 2026-07-19 - Repository port isolates Prisma and SQLite

**Decision:** Mission lifecycle code depends on a `MissionRepository` interface;
Prisma is contained in `PrismaMissionRepository`.

**Rationale:** This preserves a swappable persistence boundary and prevents
SQLite-specific storage concerns from becoming business-logic assumptions.

## 2026-07-19 - Use a single SQLite database during local development

**Decision:** Store the Phase 1 development database at
`packages/mission-engine/prisma/dev.db`.

**Rationale:** SQLite provides zero-configuration local persistence for the
hackathon while the repository boundary keeps later database migration possible.

## 2026-07-19 - Pin Prisma 6 for the Phase 1 SQLite adapter

**Decision:** Use Prisma Client and CLI `6.19.1` for the initial persistence
adapter.

**Rationale:** Prisma 6 provides the direct SQLite client required for this local
scope without introducing a driver-adapter package. The repository interface
keeps a future Prisma major-version upgrade isolated from mission business logic.

## 2026-07-19 - Treat the A2MCP agent as the primary product surface

**Decision:** NEXUS is primarily a callable Agent Service Provider. The Next.js
application is a secondary operator control plane.

**Rationale:** The OKX.AI hackathon submission is evaluated as an agent service,
not as a conventional consumer web application. Architecture, documentation, and
demo flows should lead with machine-to-machine invocation and persistent mission
execution.

## 2026-07-20 - Keep the A2MCP route as a thin Mission Engine adapter

**Decision:** `POST /api/a2mcp/mission` owns transport validation and response
mapping only. Mission creation, reads, and lifecycle transitions remain in
`@nexus/mission-engine`.

**Rationale:** The API and future operator UI must share one source of business
logic. Keeping lifecycle behavior out of the route prevents the UI or protocol
layer from becoming a second mission implementation.

## Pending - OKX ASP integration

Before Phase 4, document the current official OKX.AI ASP API shape,
authentication, manifest, and marketplace listing requirements here.
