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

### Deployment status

Railway project, service, production variables, one-replica configuration, and
the 500 MB persistent volume are provisioned. The volume is mounted at
`/app/packages/mission-engine/prisma`. On July 21, 2026, the service was updated
to the immutable GHCR image built from commit `39ec2ac`, which adds the
interactive Phase 4.5 Mission Control.

The production endpoints are:

```text
Health: https://nexus-production-40fb.up.railway.app/api/health
REST:   https://nexus-production-40fb.up.railway.app/api/a2mcp/mission
MCP:    https://nexus-production-40fb.up.railway.app/api/mcp
```

Deployment `c76d0af2-45a2-4fce-aa6e-1fa43ee1555d` reached `SUCCESS`. Live smoke
tests confirmed health, real weather research, recommendations, cost analysis,
mission resumption without duplication, persistence across container restarts,
and MCP invocation through the official TypeScript SDK.

Phase 4.5 deployment `5c1fe6f6-bf82-41af-bf12-aa01da5b23bf` also reached
`SUCCESS`. A browser-driven production test created mission
`cmrute46o0000n001oyex34j9`, rendered its real weather result, three persisted
recommendations, and `$465` cost breakdown, then resumed the same mission ID
without duplication.

## 2026-07-21 - Replace the Travel-only demo path with specialized mission flows

**Decision:** All nine mission types now run the same orchestration stages behind
mission-specific setup schemas and planning logic. The operator UI submits the
user's free-form goal plus type-specific context; the Mission Planner persists
its interpretation and next-action tasks, Recommendation and Cost Analysis
agents use type-specific builders, and the response includes tasks.

**External evidence:** Travel invokes live Open-Meteo weather plus OpenStreetMap
nearby-place MCP tools. Other mission types invoke a Wikimedia knowledge-search
MCP tool with a query assembled from the exact goal and submitted preferences.
These sources provide real external evidence without pretending that Wikimedia
is authoritative for legal, medical, financial, immigration, or contractual
requirements; recommendations explicitly preserve human and professional
verification.

**Rationale:** Clickable cards with one generic form did not satisfy the mission
operating-system boundary. Specialized setup and personalized persisted output
let NEXUS respond to the actual problem while keeping one API, Mission Engine,
and orchestrator as the source of truth.

### Remaining owner-controlled actions

1. Complete the official Agentic Wallet login or consent prompt when presented.
2. Confirm the final on-chain ASP registration card after reviewing its fields.
3. Complete any OKX email, CAPTCHA, wallet-signature, or review confirmation.
4. Optionally point a custom domain at Railway; the generated Railway HTTPS
   domain is already public and suitable for endpoint validation.

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

**Prisma engine correction:** OpenSSL must be present in both the builder and
runtime stages. Installing it only at runtime caused Prisma Client to be
generated for Debian OpenSSL 1.1 during the build, while Railway correctly
detected Debian OpenSSL 3 at runtime and rejected the mismatched query engine.
The base build stage now installs OpenSSL before `prisma generate`, ensuring the
generated engine matches the production runtime.

## 2026-07-21 - Keep the operator UI as a thin API client

**Decision:** Phase 4.5 Mission Control submits create and resume requests only
through `POST /api/a2mcp/mission` and renders the returned contract. The browser
does not import the Mission Engine, invoke MCP providers, calculate costs, or
construct recommendations.

**Rationale:** The public deployment needs an interactive demo surface without
weakening the API-first ASP architecture. Keeping the page as a client of the
same A2MCP application service ensures the REST endpoint, outward-facing MCP
tool, and operator UI all use one persistent mission and orchestration path.
Travel remains the fully demonstrated vertical slice; other mission intents can
create persistent missions while their specialized agent flows are added later.

**Build portability:** Next.js standalone tracing creates symlinks that Windows
can reject inside a OneDrive workspace even after compilation succeeds. The web
build uses Webpack consistently and emits standalone output on Linux (including
the production container build), while local Windows builds skip standalone
packaging. This preserves the smaller production image and makes root
`pnpm build` verifiable on the development machine.

## 2026-07-22 - Replace assumed Travel answers with provider-driven evidence

**Decision:** Travel is the first deep mission vertical. It requires an origin,
an exact destination city or airport, and a specific departure date before
research starts. New answers are merged into the same persisted mission; changed
answers or a recommendation-exploration action invalidate stale derived output
and rerun orchestration without creating a duplicate mission.

**Flight provider:** Use Amadeus Self-Service behind the capability registry for
Airport and City Search plus Flight Offers Search. Authentication uses OAuth
client credentials and caches the short-lived access token. The default is the
Amadeus test environment; production access remains a separate provider/account
decision. Returned offers persist route criteria, airport codes, schedules,
duration, stops, airline codes, price, currency, seats when supplied, fetch time,
and provider metadata. Search links are labeled as external route-search links,
not confirmed booking links.

**No-fabrication rule:** If `AMADEUS_CLIENT_ID` or
`AMADEUS_CLIENT_SECRET` is absent, NEXUS persists
`PROVIDER_NOT_CONFIGURED`, returns no airfare and no flight cost line, and tells
the caller what is missing. It must never replace a failed live search with a
template fare.

**Weather provider:** Open-Meteo now receives the selected travel date and
returns daily high/low temperature, precipitation probability, wind, and
conditions when the date is inside the 16-day forecast horizon. Dates outside
that horizon return `OUT_OF_RANGE` with no forecast. Current weather is never
presented as weather for a future trip.

**Exploration:** `A2MCPMissionRequest.action` supports
`EXPLORE_RECOMMENDATION`. The same mission is refreshed and additional external
knowledge research is persisted using the selected recommendation as the
follow-up query. The operator UI exposes this as an Explore action.

**Rationale:** Static travel advice and heuristic flight prices violate NEXUS's
research-first boundary. This design follows the concise origin-to-destination
interaction pattern the user identified in AirTrack while preserving NEXUS's
no-booking and no-payment boundary.

**Owner-controlled credential action:** Create or approve an Amadeus developer
application, then set `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`, and
`AMADEUS_ENVIRONMENT` in Railway. This requires an external developer account
and cannot be completed from repository code alone. Until then, the public
service remains honest but cannot return live flight offers.

## 2026-07-23 - Add durable mission-specific workflow execution

**Decision:** Preserve the Mission Engine, Prisma repository, capability
registry, A2MCP endpoint, MCP endpoint, and Railway deployment, while adding an
execution layer based on durable workflow tasks and timeline events.

Each mission type now owns a separate ordered capability workflow. Tasks persist
stable keys, capability, sequence, required/optional status, execution status,
blocking reason, and timestamps. The orchestrator independently attempts each
research task, stores evidence by task key, and records task start, completion,
block, failure, and evidence events in the mission timeline. A plain resume
retries blocked work without duplicating state.

**Progress and readiness:** Progress is derived only from completed tasks.
Blocked and failed tasks contribute zero. A mission reaches READY only when all
required tasks complete. New context or an explicit exploration action can
reactivate a READY mission, refresh derived state, and return it to READY after
the new workflow completes.

**Evidence boundary:** The previous deterministic non-Travel recommendation
templates and fixed cost allowances are superseded. Recommendation Agent now
ranks provider evidence only. Cost Analysis Agent extracts known structured
prices only. Missing evidence or price data blocks the task instead of producing
an assumed response.

**Providers:** Existing Amadeus, Open-Meteo, OpenStreetMap, Wikimedia, MCP, and
provider-registry boundaries are retained. Amadeus now includes hotel offers;
OpenStreetMap includes nearby transport; Frankfurter plus REST Countries
provides currency evidence; Tavily provides source-preserving current research
for broad and regulated capabilities when configured.

**Legacy SQLite safety:** New task keys are nullable at the database level so
the existing Railway volume can migrate without deleting legacy task rows. All
new workflow tasks always receive a stable key, and legacy rows map their ID as
a fallback key.

**Owner action required:** Add `TAVILY_API_KEY` to Railway for broad live
research. `AMADEUS_CLIENT_ID` and `AMADEUS_CLIENT_SECRET` are optional and should
be added only if live Amadeus flight, airport, and hotel capabilities are
desired. Missing capabilities remain visibly BLOCKED and NEXUS returns no
fabricated result. No account-bound credential is committed to the repository.

## 2026-07-23 - Make Tavily the default evidence provider and Amadeus optional

**Decision:** Register Amadeus only when both Amadeus credentials are present.
Workflow definitions request generic `airports`, `flights`, and `hotels`
capabilities and do not depend on the Amadeus class. If no flight provider is
registered, the task is `BLOCKED` with the exact reason
`No flight provider configured`; weather, places, visa, currency,
transportation, and other independent research continue.

**Tavily evidence boundary:** Tavily is the first-choice provider for broad
research capabilities including visa, immigration, jobs, universities,
programs, scholarships, housing, healthcare, government documents, relocation,
events, transportation, freight, customs, property, employers, salaries, and
medical logistics. The provider requests Tavily's advanced synthesized answer
and persists that answer with the returned source excerpts and URLs. NEXUS ranks
and summarizes only this returned evidence; it does not insert unsupported
mission advice.

**Confidence:** Every persisted research result includes a normalized
`confidenceScore`. Tavily confidence is derived from returned relevance scores;
structured first-party providers use a provider-specific confidence value. The
A2MCP response exposes each score and an average across external evidence.

**Partial readiness:** A mission reaches `READY` once every scheduled task is
terminal (`COMPLETED`, `BLOCKED`, or `FAILED`). Progress remains the percentage
of tasks actually completed and is not forced to 100 for READY missions. The
response includes completed, blocked, and failed task lists, collected evidence,
average confidence, and pending actions needed to unlock missing capabilities.
A plain resume reopens and retries blocked work without duplicating mission
state.

**Credential handling:** `TAVILY_API_KEY` is required for broad live research
and must be stored only as a local or Railway secret. Amadeus credentials are
optional and no longer block Travel missions.

## 2026-07-24 - Persist conversation and bound deep Tavily enrichment

**Decision:** Store every in-mission USER and AGENT message as
`MissionConversationMessage` and expose it through both REST and the
`nexus_mission` MCP tool. A `message` is valid only when resuming an existing
mission. The Conversation Agent can convert clear labeled facts and
origin/destination/date replies into setup-answer updates, or decompose a
follow-up into one or two research queries. Corrections refresh task-owned
derived output but never delete conversation history or create a new mission.

**Tavily flow:** Tavily Search remains the required evidence call. After a
successful search, NEXUS attempts Extract for at most the top three unique URLs,
with at most three chunks per source. Explicit deep/verify/compare requests may
run a second focused Search and Crawl one top source at depth one with an
eight-page limit. Search evidence remains usable if Extract or Crawl fails; the
failure is stored as an enrichment warning instead of failing the mission.
Requests authenticate with the current official `Authorization: Bearer`
header.

**Rationale:** Durable conversation makes the mission independent of a browser
session and lets both humans and agents refine the same persisted work. Bounded
enrichment adds source detail without allowing an unbounded crawl to inflate
latency or Tavily usage.

**Current parsing boundary:** Setup corrections are deterministic and accept
clear labels plus common route/date phrasing. Ambiguous prose is not guessed;
NEXUS retains the message and asks only the remaining required questions. A
general LLM-backed semantic parser and source-conflict Reasoning Agent remain
future work.

## 2026-07-24 - Resolve currencies independently and synthesize recommendations

**Country capability:** Add `RestCountriesProvider` behind the generic
`countries` capability. It calls the keyless REST Countries v3.1 name and alpha
endpoints first. Because v3.1 is deprecated and the maintained hosted API now
requires authentication, the provider can fall back to the open upstream
country dataset maintained in `mledoze/countries`. If the input is a city/state
such as `benue`, it uses Open-Meteo geocoding only to obtain an ISO country code,
then resolves the ISO 4217 currency through REST Countries or the fallback
dataset. The Currency research task resolves both sides before calling
Frankfurter, so it no longer depends on an airport provider. Failed name
resolution blocks with the unresolved input rather than guessing a code.

**Production compatibility:** The deprecated v3.1 endpoint can return an HTTP
200 error envelope instead of a country record. The provider validates the
country name, ISO code, and currency fields before accepting any response;
deprecation or error envelopes fall through to the open dataset. This behavior
is covered by the China-to-Benue route regression test.

**Evidence query scope:** Replace the all-setup-fields query dump with
capability-specific field templates. Regulated and route research receives only
relevant facts. Tavily Search now forwards bounded `include_domains` and
`exclude_domains`; non-technical mission research excludes programming/Q&A
domains such as Stack Overflow before results are returned.

**Recommendation boundary:** Item-shaped external evidence is not copied into
recommendations. The Recommendation Agent requires overlap with persisted
mission destination/topic terms, removes same-source/topic duplicates,
synthesizes a short "why this matters" statement, and caps the complete
recommendation list at three. If no item supports real synthesis, the task
blocks instead of echoing the Evidence section.

**Operator UI:** Missing optional flight, airport, or hotel providers are shown
as neutral `NOT AVAILABLE` policy notices and excluded from the operational
blocked count. This distinguishes an intentional provider boundary from a
failed task.
