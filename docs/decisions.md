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

## 2026-07-20 - Use the official MCP SDK with a linked in-memory transport

**Decision:** Use `@modelcontextprotocol/sdk` `1.29.0` to connect the NEXUS
weather MCP client and server through `InMemoryTransport`, then invoke
`get_current_weather` with `Client.callTool`.

**Rationale:** This is the smallest real MCP vertical slice that works inside a
Next.js route without spawning a sidecar process. It exercises MCP capability
negotiation, tool validation, and structured tool results while the provider
interface remains swappable for a remote Streamable HTTP server later.

## 2026-07-20 - Use Open-Meteo for the first real research provider

**Decision:** The weather MCP tool resolves destinations and fetches current
weather through Open-Meteo's public geocoding and forecast APIs.

**Rationale:** It requires no payment or account credentials, returns structured
observations, and provides a verifiable real-world result for the Travel mission
vertical slice.

## 2026-07-20 - Persist research results as append-only mission records

**Decision:** Store each agent result in `MissionResearchResult` with provider,
capability, summary, JSON data, and timestamp.

**Rationale:** A resume invocation should preserve evidence from earlier runs.
The orchestrator reuses existing weather evidence instead of repeating an
external call merely because the mission was resumed. New research can still
append fresh records later without hardcoding weather-specific columns into
mission business logic.

## 2026-07-20 - OKX ASP integration requirements verified

**Sources checked:**

- OKX.AI A2MCP Guide:
  `https://web3.okx.com/onchainos/dev-docs/okxai/howtomcp`
- OKX.AI ASP Registration:
  `https://web3.okx.com/onchainos/dev-docs/okxai/registerasp`
- Official Onchain OS ASP identity registration workflow:
  `https://github.com/okx/onchainos-skills/blob/main/skills/okx-ai/references/identity-register.md`
- OKX Payment SDK seller integration:
  `https://web3.okx.com/onchainos/dev-docs/payments/service-seller-sdk`

**Verified endpoint requirement:** An A2MCP service must use one of two forms:

1. Free endpoint: returns the result directly with HTTP `200`; no x402 payment
   challenge or billing middleware.
2. Paid endpoint: first returns a standard HTTP `402 Payment Required` x402
   challenge, then returns the result when the paid request is replayed. The OKX
   Payment SDK is the recommended implementation.

Both forms must be deployed at a publicly reachable HTTPS URL tied to a domain.
Registration rejects HTTP, localhost, loopback/private addresses, local/internal
hostnames, placeholders, and endpoint URLs longer than 512 characters.

**Authentication finding:** The current free-endpoint documentation does not
specify an OKX request-authentication header or signing scheme. The endpoint is
called directly. Paid endpoint authentication is payment verification through
x402/OKX Payment SDK, which requires OKX Developer credentials and a receiving
wallet.

**Manifest finding:** The current official OKX.AI documentation does not define
a repository manifest file or JSON manifest endpoint for A2MCP ASPs. Do not
invent one. Listing data is submitted through the Onchain OS Agent Identity
registration workflow.

**Verified listing fields and workflow:**

- Install the official Onchain OS skill and authenticate through Agentic Wallet.
- Register an ASP identity with a brand name, required description, and required
  uploaded avatar file; avatar URLs are rejected.
- Submit one or more services. Each A2MCP service needs a descriptive service
  name, a two-part description (capability/audience and required caller inputs),
  canonical type `A2MCP`, fee as a quoted numeric string in USDT (`"0"` for
  free), and the public HTTPS endpoint.
- The service name must be a descriptive noun phrase. Listing descriptions must
  not expose implementation-stack details, links, examples, or disclaimers.
- Run the official `validate-listing` gate once on the complete ASP/service
  payload, review any blocking findings, then confirm the on-chain identity
  creation.
- Registration alone is not marketplace visibility. The ASP must then be
  activated/listed, pass OKX review, and go live. Official docs state review is
  normally completed within 24 hours/one business day.

**Decision for NEXUS:** Implement the Phase 4 endpoint as a **free A2MCP
service** with fee `"0"`. This avoids x402 and receiving-wallet integration,
preserves NEXUS's no-payment/no-financial-account boundary, and requires direct
HTTP `200` JSON responses. No speculative manifest or authentication scheme will
be added.

**External release gate:** Code can implement and verify the compliant free
endpoint locally, but marketplace eligibility additionally requires a deployed
public HTTPS URL, uploaded avatar, Agentic Wallet identity registration,
`validate-listing`, review, and activation. Those account-bound steps cannot be
truthfully claimed complete until performed with the owner's OKX credentials and
deployment domain.

## 2026-07-20 - Persist Phase 4 outputs as idempotent mission state

**Decision:** Store ranked recommendations, informational cost estimates, and
notifications as mission-owned records. The orchestrator creates each output set
once and reuses it on resume.

**Rationale:** A2MCP resume calls must continue one persistent mission without
duplicating work. Separate records keep the API machine-readable and preserve
the Mission Engine as the source of truth. Unique rank/category/message
constraints protect the current one-pass Phase 4 flow from accidental duplicate
inserts.

## 2026-07-20 - Keep Phase 4 cost analysis deterministic and non-transactional

**Decision:** The Cost Analysis Agent returns a bounded USD planning allowance
for local transport, meals, weather preparation, and contingency. It does not
quote bookings or invoke payment services.

**Rationale:** Phase 4 needs a demonstrable cost breakdown while preserving the
hard boundary against payments, bookings, wallets, and financial accounts.
Every response labels the total as informational and subject to human
verification.

## 2026-07-20 - OKX A2MCP registration and public transport correction

**Sources rechecked:**

- OKX.AI A2MCP Guide:
  `https://web3.okx.com/onchainos/dev-docs/okxai/howtomcp`
- OKX.AI ASP Registration:
  `https://web3.okx.com/onchainos/dev-docs/okxai/registerasp`

**Registration workflow:** ASP registration is conversational through an agent
after installing OKX's OnchainOS Skills with
`npx skills add okx/onchainos-skills --yes -g` and authenticating an Agentic
Wallet. NEXUS will not author or publish a speculative manifest file.

**Service pricing:** Register NEXUS as a free A2MCP service. It returns results
directly and does not use x402 or the OKX Payment SDK. This preserves the
no-payment, no-booking, and no-financial-account boundary.

**Public MCP boundary:** Add an outward-facing MCP server using the official MCP
TypeScript SDK and Streamable HTTP transport. It exposes mission
creation/resumption as a callable tool and delegates to the same Mission Engine
and Mission Orchestrator used by the REST adapter. No mission business logic is
duplicated in the transport layer.

**Deployment gate:** Marketplace registration requires a publicly reachable
HTTPS endpoint on a real domain. No hosting account, domain, or deployment will
be provisioned without explicit owner approval because those steps may involve
account access or cost. Railway with a persistent volume is the recommended
first hosting option for the current Next.js plus Prisma/SQLite scope. Vercel's
runtime filesystem is ephemeral, so Vercel is suitable only after moving mission
persistence to an external managed database.

**Review timeline:** OKX sends the review result by email. The current official
registration page says review is normally completed within 24 hours; NEXUS will
reserve 1-2 business days in the submission schedule as an operational buffer.

**Deferred real-world actions:** Do not install OnchainOS Skills, authenticate an
Agentic Wallet, register/list the ASP, provision hosting, or configure a domain
until the owner explicitly approves those actions.

## 2026-07-21 - Railway deployment uses Docker, standalone Next.js, and a volume-backed SQLite database

**Decision:** Keep a portable production image at `deploy/Dockerfile`. The build
installs the complete pnpm workspace, generates Prisma Client, and produces the
Next.js standalone server. At runtime, the container synchronizes the Prisma
schema and starts the standalone server.

**Rationale:** Explicit Docker stages make monorepo dependency installation and
Prisma generation reproducible. Next.js standalone output keeps the application
runtime smaller than copying the entire workspace. A small Prisma CLI install is
retained in the runtime image because Railway volumes are attached only at
runtime, so a new or existing SQLite database must be synchronized after the
volume is available.

**Database path:** Prisma now reads `DATABASE_URL`. Local commands default to
`file:./dev.db`, which preserves
`packages/mission-engine/prisma/dev.db`. Railway must set:

```text
DATABASE_URL=file:/app/packages/mission-engine/prisma/dev.db
```

The Railway volume mount path must be:

```text
/app/packages/mission-engine/prisma
```

The Docker `VOLUME` instruction documents the required mount point, but it does
not create or attach a Railway volume. That account-bound action must be
performed in Railway.

**Railway configuration:** Railway currently uses the Railpack commands recorded
below and checks `/api/health`. The health route verifies that Prisma can query
SQLite, catching a missing volume, invalid `DATABASE_URL`, or unsynchronized
database.
For local inspection after `pnpm build`, `pnpm --filter @nexus/web
start:standalone` runs the generated standalone server.

**Operational constraint:** Run one Railway replica while using SQLite. A
single writable volume and SQLite database are not a multi-replica persistence
design.

### Owner action required

1. Sign in to Railway and create a new project from the
   `BestofAbdul/NEXUS` GitHub repository.
2. Confirm Railway loaded `railway.json`. Leave the root directory at the
   repository root.
3. Open the NEXUS service, create a persistent volume, and mount it at
   `/app/packages/mission-engine/prisma`.
4. In the service Variables page, set
   `DATABASE_URL=file:/app/packages/mission-engine/prisma/dev.db` and
   `NODE_ENV=production`. Railway supplies `PORT`; do not hardcode it.
5. Keep the service at one replica. Deploy and wait for `/api/health` to report
   HTTP `200` with `{"status":"ok"}`.
6. In Railway Networking, generate a Railway HTTPS domain for the first smoke
   test. Verify `/api/mcp` is reachable at that domain.
7. Add the final custom domain in Railway, then copy Railway's displayed DNS
   record into the domain provider's DNS settings. Wait for Railway to show the
   domain and TLS certificate as active.
8. Only after the public HTTPS MCP endpoint works, proceed separately with the
   owner-approved OnchainOS Skills installation, Agentic Wallet login, and OKX
   ASP registration.

## 2026-07-21 - Railway Railpack fallback after Metal Docker builder failure

**Decision:** Keep `deploy/Dockerfile` as the portable production image, but
configure Railway to use Railpack with explicit root-workspace build and start
commands.

**Rationale:** Two Railway Docker deployments failed on July 21, 2026 before
the Dockerfile executed. Railway recorded only Metal builder scheduling events
and a generic `Failed to build an image` stage error. The source snapshot,
Dockerfile path, volume, variables, and service manifest were all present.
Railway always auto-selected a root Dockerfile even when `builder` was
`RAILPACK`, so the Dockerfile was moved to `deploy/Dockerfile`. Railpack then
preserves the same verified steps: root pnpm workspace install, Prisma
generation, Next.js build, runtime `prisma db push`, one replica, and the
volume-backed `DATABASE_URL`.

**Railway commands:**

```text
Build: pnpm --filter @nexus/mission-engine db:generate && pnpm build
Start: pnpm --filter @nexus/mission-engine db:push && pnpm --filter @nexus/web start
```

The portable image remains available with
`docker build -f deploy/Dockerfile .` for a later Railway Docker retry or
another container host.

## 2026-07-21 - Publish a prebuilt image to bypass Railway Metal builder failures

**Decision:** GitHub Actions builds `deploy/Dockerfile` and publishes immutable
commit tags plus `ghcr.io/bestofabdul/nexus:latest` to GitHub Container
Registry. Railway consumes that public image directly instead of building the
repository.

**Rationale:** Docker and Railpack deployments both failed before any project
build command ran, including a local CLI source snapshot. Publishing the same
portable image through GitHub Actions separates application build verification
from the unavailable Railway Metal builder while retaining Railway for runtime,
HTTPS networking, and the persistent SQLite volume.

**Operational rule:** The GHCR package must be public so Railway can pull it
without registry credentials. Railway must continue mounting
`/app/packages/mission-engine/prisma`, setting the production `DATABASE_URL`,
and running one replica. A deployment is complete only after Railway reports
`SUCCESS` and the health, REST, and MCP endpoints pass live smoke tests.

**Build correction:** The first GitHub Actions build showed that pnpm 11.9.0
requires Node.js 22.13 or newer and uses the `node:sqlite` built-in. The
production image therefore uses Node.js 22, which remains within the repository's
fixed Node.js 20+ runtime decision. This replaces the earlier Node.js 20 image
that could compile locally with a different pnpm runtime but could not execute
the pinned package manager inside the container.

The runtime stage also installs OpenSSL explicitly. The first successful Railway
start showed Prisma falling back to an assumed OpenSSL version because the slim
base image did not provide the library metadata. SQLite queries worked, but the
dependency is installed to remove that native-runtime ambiguity.
