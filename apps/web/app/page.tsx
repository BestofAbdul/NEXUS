"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type {
  A2MCPMissionResponse,
  A2MCPMissionResult,
  MissionType,
} from "@nexus/shared";

interface SetupField {
  key: string;
  label: string;
  placeholder: string;
  wide?: boolean;
  inputType?: "text" | "date" | "number";
  required?: boolean;
}

interface MissionOption {
  label: string;
  type: MissionType;
  code: string;
  detail: string;
  goal: string;
  setupTitle: string;
  setupDescription: string;
  fields: SetupField[];
  defaults: Record<string, string>;
}

const missionOptions: MissionOption[] = [
  {
    label: "Travel",
    type: "TRAVEL",
    code: "TRV",
    detail: "Compare real routes, flight offers, dated weather, and places.",
    goal: "Plan a trip around my interests, time, and budget",
    setupTitle: "Shape the trip you actually want.",
    setupDescription:
      "NEXUS asks only for route details that block research, then checks airports, live flight offers, weather for your selected date, and nearby places.",
    fields: [
      {
        key: "origin",
        label: "Travelling from",
        placeholder: "Lagos or LOS",
        required: true,
      },
      {
        key: "destination",
        label: "City or airport",
        placeholder: "New York or JFK",
        required: true,
      },
      {
        key: "departureDate",
        label: "Departure date",
        placeholder: "",
        inputType: "date",
        required: true,
      },
      {
        key: "returnDate",
        label: "Return date (optional)",
        placeholder: "",
        inputType: "date",
      },
      {
        key: "travelers",
        label: "Adult travellers",
        placeholder: "1",
        inputType: "number",
      },
      { key: "cabin", label: "Cabin", placeholder: "Economy" },
      {
        key: "directFlights",
        label: "Direct flights only",
        placeholder: "true or false",
      },
      { key: "budget", label: "Working budget", placeholder: "$2,000" },
      {
        key: "preferences",
        label: "Interests and preferences",
        placeholder:
          "I like local food, art, quiet neighborhoods, and one major attraction per day.",
        wide: true,
      },
    ],
    defaults: {
      travelers: "1",
      cabin: "Economy",
      directFlights: "false",
      preferences: "Local food, culture, and a relaxed daily pace",
    },
  },
  {
    label: "Relocate",
    type: "RELOCATE",
    code: "RLC",
    detail: "Compare pathways, cities, housing, work, and settlement steps.",
    goal: "Build a relocation plan around my work, housing, and settlement priorities",
    setupTitle: "Plan the move around your real constraints.",
    setupDescription:
      "NEXUS will organize pathway research, settlement trade-offs, documents, housing, and the move timeline.",
    fields: [
      { key: "destination", label: "Moving to", placeholder: "Canada" },
      { key: "movingFrom", label: "Moving from", placeholder: "Nigeria" },
      { key: "targetDate", label: "Target move date", placeholder: "March 2027" },
      { key: "household", label: "Who is moving", placeholder: "Me and my spouse" },
      { key: "workStatus", label: "Work situation", placeholder: "Software engineer seeking work" },
      {
        key: "priorities",
        label: "Priorities and constraints",
        placeholder:
          "Affordable rent, strong technology jobs, public transport, and a welcoming community.",
        wide: true,
      },
    ],
    defaults: {
      destination: "Canada",
      movingFrom: "Nigeria",
      priorities: "Affordable housing, job access, and public transport",
    },
  },
  {
    label: "Study Abroad",
    type: "STUDY_ABROAD",
    code: "STD",
    detail: "Find program fit, admission requirements, funding, and visa steps.",
    goal: "Find a study-abroad path that fits my academic and career goals",
    setupTitle: "Match the program to your future, not a generic ranking.",
    setupDescription:
      "NEXUS will organize program criteria, admissions evidence, funding, and the application timeline.",
    fields: [
      { key: "destination", label: "Preferred country", placeholder: "United Kingdom" },
      { key: "subject", label: "Subject", placeholder: "Data Science" },
      { key: "studyLevel", label: "Study level", placeholder: "Master's" },
      { key: "intake", label: "Target intake", placeholder: "September 2027" },
      { key: "budget", label: "Annual budget", placeholder: "$25,000" },
      {
        key: "preferences",
        label: "Academic and lifestyle preferences",
        placeholder:
          "Scholarship opportunities, practical coursework, post-study work options, and a diverse city.",
        wide: true,
      },
    ],
    defaults: {
      subject: "Data Science",
      studyLevel: "Master's",
      preferences: "Scholarships and strong graduate employment outcomes",
    },
  },
  {
    label: "Buy / Rent",
    type: "BUY_RENT_PROPERTY",
    code: "HME",
    detail: "Turn housing needs into comparable neighborhoods and checks.",
    goal: "Find a home that fits my budget, location, and daily needs",
    setupTitle: "Define the home before searching listings.",
    setupDescription:
      "NEXUS will structure affordability, neighborhood fit, viewing questions, and due-diligence checks.",
    fields: [
      { key: "propertyGoal", label: "Buy or rent", placeholder: "Rent" },
      { key: "location", label: "Target location", placeholder: "Lagos" },
      { key: "budget", label: "Maximum budget", placeholder: "$1,200 monthly" },
      { key: "bedrooms", label: "Bedrooms", placeholder: "2" },
      { key: "moveDate", label: "Move date", placeholder: "October 2026" },
      {
        key: "priorities",
        label: "Must-haves and trade-offs",
        placeholder:
          "Safe area, reliable power, 30-minute commute, parking, and room to work from home.",
        wide: true,
      },
    ],
    defaults: {
      propertyGoal: "Rent",
      bedrooms: "2",
      priorities: "Safety, commute, reliable utilities, and value",
    },
  },
  {
    label: "New Job",
    type: "NEW_JOB",
    code: "JOB",
    detail: "Focus positioning, target employers, applications, and interviews.",
    goal: "Land a role that fits my strengths and career goals",
    setupTitle: "Build a focused job mission, not a mass application plan.",
    setupDescription:
      "NEXUS will turn your experience and preferences into positioning, target-company research, and concrete preparation tasks.",
    fields: [
      { key: "targetRole", label: "Target role", placeholder: "Senior Backend Engineer" },
      { key: "industry", label: "Industry", placeholder: "Fintech" },
      { key: "location", label: "Location or remote", placeholder: "Remote / Europe" },
      { key: "experience", label: "Experience", placeholder: "6 years" },
      { key: "salary", label: "Compensation target", placeholder: "$90k+" },
      {
        key: "preferences",
        label: "Strengths and job preferences",
        placeholder:
          "TypeScript and distributed systems, remote-first team, ownership, and clear growth.",
        wide: true,
      },
    ],
    defaults: {
      targetRole: "Senior Backend Engineer",
      industry: "Technology",
      preferences: "Remote-friendly work, ownership, and career growth",
    },
  },
  {
    label: "Plan an Event",
    type: "PLAN_EVENT",
    code: "EVT",
    detail: "Coordinate the experience, venue, suppliers, schedule, and fallback.",
    goal: "Plan an event that delivers the right guest experience",
    setupTitle: "Design the guest experience before choosing suppliers.",
    setupDescription:
      "NEXUS will create the event brief, critical path, budget allowances, and an owner-driven run of show.",
    fields: [
      { key: "eventType", label: "Event type", placeholder: "Community meetup" },
      { key: "location", label: "Location", placeholder: "Abuja" },
      { key: "date", label: "Event date", placeholder: "December 12, 2026" },
      { key: "guestCount", label: "Expected guests", placeholder: "80" },
      { key: "budget", label: "Budget", placeholder: "$3,000" },
      {
        key: "preferences",
        label: "Experience and constraints",
        placeholder:
          "Welcoming, practical talks, local food, accessible venue, and a strong networking session.",
        wide: true,
      },
    ],
    defaults: {
      eventType: "Community meetup",
      guestCount: "80",
      preferences: "Welcoming, accessible, and easy for guests to navigate",
    },
  },
  {
    label: "Medical Trip",
    type: "MEDICAL_TRIP",
    code: "MED",
    detail: "Prepare non-clinical travel, accessibility, and support logistics.",
    goal: "Prepare safe, low-stress logistics for an upcoming medical trip",
    setupTitle: "Make the journey easier without replacing medical advice.",
    setupDescription:
      "NEXUS handles travel and support logistics only. Clinical instructions must come directly from licensed professionals.",
    fields: [
      { key: "destination", label: "Destination", placeholder: "London" },
      { key: "appointmentType", label: "Visit type", placeholder: "Scheduled procedure" },
      { key: "dates", label: "Appointment and travel dates", placeholder: "November 3-12" },
      { key: "companions", label: "Travel companions", placeholder: "One family member" },
      { key: "accessibility", label: "Accessibility needs", placeholder: "Limited walking after appointment" },
      {
        key: "preferences",
        label: "Logistics concerns",
        placeholder:
          "Quiet accommodation near the provider, flexible return date, and simple airport transfers.",
        wide: true,
      },
    ],
    defaults: {
      companions: "One support person",
      preferences: "Low-stress travel and accommodation close to the provider",
    },
  },
  {
    label: "Move Goods",
    type: "MOVE_GOODS",
    code: "LOG",
    detail: "Organize inventory, route, customs, handling, and delivery evidence.",
    goal: "Move my goods safely with clear costs, timing, and responsibilities",
    setupTitle: "Define the shipment before comparing carriers.",
    setupDescription:
      "NEXUS will structure route questions, documentation, packing, insurance, and handoff checks.",
    fields: [
      { key: "origin", label: "Origin", placeholder: "Lagos, Nigeria" },
      { key: "destination", label: "Destination", placeholder: "Toronto, Canada" },
      { key: "items", label: "What is moving", placeholder: "Books, clothes, electronics, furniture" },
      { key: "timeline", label: "Required arrival", placeholder: "Within 8 weeks" },
      { key: "volume", label: "Approximate volume", placeholder: "Half a container" },
      {
        key: "priorities",
        label: "Handling priorities",
        placeholder:
          "Careful electronics packing, full tracking, customs clarity, and no surprise destination fees.",
        wide: true,
      },
    ],
    defaults: {
      priorities: "Clear total cost, safe handling, tracking, and customs support",
    },
  },
  {
    label: "Custom Mission",
    type: "CUSTOM",
    code: "CUS",
    detail: "Turn any outcome into research, decisions, and next actions.",
    goal: "",
    setupTitle: "Tell NEXUS what success looks like.",
    setupDescription:
      "Use this when the mission does not fit a preset. NEXUS will interpret the desired outcome, constraints, and next decision.",
    fields: [
      { key: "desiredOutcome", label: "Desired outcome", placeholder: "What must be true when this is complete?" },
      { key: "deadline", label: "Deadline", placeholder: "December 2026" },
      { key: "stakeholders", label: "People involved", placeholder: "Me, my team, and a vendor" },
      { key: "budget", label: "Budget boundary", placeholder: "Under $1,000" },
      { key: "constraints", label: "Known constraints", placeholder: "Limited weekends and no upfront payment" },
      {
        key: "preferences",
        label: "Anything else NEXUS should consider",
        placeholder:
          "Explain the trade-offs clearly, prioritize low-risk steps, and flag decisions that need me.",
        wide: true,
      },
    ],
    defaults: {},
  },
];

interface ApiError {
  error?: { code?: string; message?: string };
}

const dashboardLabels: Record<
  MissionType,
  { evidence: string; tasks: string; budget: string }
> = {
  TRAVEL: {
    evidence: "Flights, stays, weather, entry and destination evidence",
    tasks: "Travel workflow",
    budget: "Verified travel prices",
  },
  RELOCATE: {
    evidence: "Immigration, jobs, housing, healthcare and tax evidence",
    tasks: "Relocation workflow",
    budget: "Verified relocation costs",
  },
  STUDY_ABROAD: {
    evidence: "Universities, programs, scholarships and visa evidence",
    tasks: "Study workflow",
    budget: "Verified study costs",
  },
  BUY_RENT_PROPERTY: {
    evidence: "Listings, mortgage, neighbourhood, safety and tax evidence",
    tasks: "Property workflow",
    budget: "Verified property costs",
  },
  NEW_JOB: {
    evidence: "Live roles, employers, salary and authorization evidence",
    tasks: "Job-search workflow",
    budget: "Verified career costs",
  },
  PLAN_EVENT: {
    evidence: "Venues, suppliers, weather and transport evidence",
    tasks: "Event workflow",
    budget: "Verified event quotes",
  },
  MEDICAL_TRIP: {
    evidence: "Hospitals, doctors, insurance and logistics evidence",
    tasks: "Medical travel workflow",
    budget: "Verified logistics costs",
  },
  MOVE_GOODS: {
    evidence: "Carriers, customs, insurance and route evidence",
    tasks: "Freight workflow",
    budget: "Verified shipping quotes",
  },
  CUSTOM: {
    evidence: "Mission evidence",
    tasks: "Custom workflow",
    budget: "Verified costs",
  },
};

export default function MissionControl() {
  const initial = missionOptions[0];
  const [selected, setSelected] = useState<MissionOption>(initial);
  const [goal, setGoal] = useState(initial.goal);
  const [context, setContext] = useState<Record<string, string>>(
    initial.defaults,
  );
  const [mission, setMission] = useState<A2MCPMissionResponse | null>(null);
  const [conversationDraft, setConversationDraft] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");

  function selectMission(option: MissionOption) {
    setSelected(option);
    setGoal(option.goal);
    setContext(option.defaults);
    setMission(null);
    setError("");
    document
      .getElementById("launch-mission")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateContext(key: string, value: string) {
    setContext((current) => ({ ...current, [key]: value }));
  }

  async function runMission(
    event?: FormEvent,
    resume = false,
    action?: {
      type: "EXPLORE_RECOMMENDATION";
      recommendationId: string;
      query: string;
    },
    message?: string,
  ) {
    event?.preventDefault();
    setIsRunning(true);
    setError("");

    try {
      const cleanContext = Object.fromEntries(
        Object.entries(context).filter(([, value]) => value.trim().length > 0),
      );
      const response = await fetch("/api/a2mcp/mission", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          goal: goal.trim(),
          missionType: selected.type,
          missionId: resume ? mission?.missionId : undefined,
          context: message ? undefined : cleanContext,
          action,
          message,
        }),
      });
      const body = (await response.json()) as
        | A2MCPMissionResponse
        | ApiError;
      if (!response.ok || !("missionId" in body)) {
        throw new Error(
          "error" in body
            ? body.error?.message ?? "NEXUS could not start this mission."
            : "NEXUS could not start this mission.",
        );
      }

      setMission(body);
      if (message) setConversationDraft("");
      requestAnimationFrame(() => {
        document
          .getElementById("mission-output")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "NEXUS could not reach the mission service.",
      );
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="/" aria-label="NEXUS home">
          <span className="brand-mark" aria-hidden="true">N</span>
          <span>NEXUS</span>
        </a>
        <div className="system-state">
          <span className="state-dot" />
          Live agent service
        </div>
      </header>

      <section className="mission-hero">
        <div className="hero-index">A2MCP / AUTONOMOUS MISSION CONTROL</div>
        <div className="hero-grid">
          <div>
            <p className="eyebrow">NEXUS AUTONOMOUS MISSION AGENT</p>
            <h1>Describe the outcome. NEXUS builds the path.</h1>
          </div>
          <div className="hero-aside">
            <p>
              Every mission uses its own setup, planning logic, recommendations,
              tasks, and cost model. Tell NEXUS what matters in your own words.
            </p>
            <a href="#launch-mission">Launch a mission <span>↓</span></a>
          </div>
        </div>
      </section>

      <section className="mission-section" aria-labelledby="mission-types-title">
        <div className="section-heading">
          <div>
            <p className="section-number">01</p>
            <h2 id="mission-types-title">Choose an intent</h2>
          </div>
          <span>9 SPECIALIZED MISSION FLOWS</span>
        </div>
        <div className="mission-grid">
          {missionOptions.map((option, index) => (
            <button
              className={`mission-card ${
                selected.type === option.type ? "is-selected" : ""
              }`}
              key={option.code}
              onClick={() => selectMission(option)}
              type="button"
            >
              <span className="card-topline">
                <span>{option.code}</span>
                <span>{String(index + 1).padStart(2, "0")}</span>
              </span>
              <span className="card-copy">
                <strong>{option.label}</strong>
                <span>{option.detail}</span>
              </span>
              <span className="card-arrow" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
      </section>

      <section
        className="launch-section"
        id="launch-mission"
        aria-labelledby="launch-title"
      >
        <div className="section-heading">
          <div>
            <p className="section-number">02</p>
            <h2 id="launch-title">{selected.label} brief</h2>
          </div>
          <span>{selected.code} / PERSONALIZED SETUP</span>
        </div>

        <div className="launch-layout">
          <div className="launch-intro">
            <p className="launch-kicker">WHAT NEXUS WILL SOLVE</p>
            <h3>{selected.setupTitle}</h3>
            <p>{selected.setupDescription}</p>
            <ol>
              <li><span>01</span> Interpret your exact outcome</li>
              <li><span>02</span> Research and expose trade-offs</li>
              <li><span>03</span> Return priorities, tasks, and costs</li>
            </ol>
          </div>

          <form className="mission-form" onSubmit={(event) => runMission(event)}>
            <label className="goal-field">
              <span>WHAT DO YOU WANT TO ACCOMPLISH?</span>
              <textarea
                name="goal"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder="Describe the outcome in your own words."
                required
                rows={3}
              />
            </label>

            <div className="setup-grid">
              {selected.fields.map((field) => (
                <label
                  className={field.wide ? "preference-field" : ""}
                  key={field.key}
                >
                  <span>{field.label}</span>
                  {field.wide ? (
                    <textarea
                      name={field.key}
                      value={context[field.key] ?? ""}
                      onChange={(event) =>
                        updateContext(field.key, event.target.value)
                      }
                      placeholder={field.placeholder}
                      rows={3}
                    />
                  ) : (
                    <input
                      type={field.inputType ?? "text"}
                      name={field.key}
                      value={context[field.key] ?? ""}
                      onChange={(event) =>
                        updateContext(field.key, event.target.value)
                      }
                      placeholder={field.placeholder}
                      required={field.required}
                    />
                  )}
                </label>
              ))}
            </div>

            {error && (
              <div className="form-error" role="alert">
                <span>REQUEST FAILED</span>
                {error}
              </div>
            )}
            <button className="launch-button" disabled={isRunning} type="submit">
              <span>
                {isRunning ? "NEXUS is working" : `Start ${selected.label} mission`}
              </span>
              <span aria-hidden="true">{isRunning ? "..." : "→"}</span>
            </button>
          </form>
        </div>
      </section>

      {mission ? (
        <MissionOutput
          mission={mission}
          isRunning={isRunning}
          onResume={() => runMission(undefined, true)}
          onExplore={(recommendationId, query) =>
            runMission(undefined, true, {
              type: "EXPLORE_RECOMMENDATION",
              recommendationId,
              query,
            })
          }
          conversationDraft={conversationDraft}
          onConversationDraftChange={setConversationDraft}
          onSendMessage={(event) =>
            runMission(
              event,
              true,
              undefined,
              conversationDraft.trim(),
            )
          }
        />
      ) : (
        <section className="active-section" aria-labelledby="active-title">
          <div className="section-heading">
            <div>
              <p className="section-number">03</p>
              <h2 id="active-title">Mission output</h2>
            </div>
            <span>AWAITING YOUR BRIEF</span>
          </div>
          <div className="empty-state">
            <span className="empty-symbol">+</span>
            <div>
              <h3>NEXUS will turn your answers into a working mission.</h3>
              <p>
                The dashboard will show how your preferences changed the plan,
                what to do next, and what still needs human verification.
              </p>
            </div>
            <span className="phase-label">API + AGENTS + MCP ONLINE</span>
          </div>
        </section>
      )}
    </main>
  );
}

function MissionOutput({
  mission,
  isRunning,
  onResume,
  onExplore,
  conversationDraft,
  onConversationDraftChange,
  onSendMessage,
}: {
  mission: A2MCPMissionResponse;
  isRunning: boolean;
  onResume: () => void;
  onExplore: (recommendationId: string, query: string) => void;
  conversationDraft: string;
  onConversationDraftChange: (value: string) => void;
  onSendMessage: (event: FormEvent) => void;
}) {
  const labels = dashboardLabels[mission.missionType];
  const policyNotices = mission.tasks
    .map((task) => providerPolicyNotice(task.blockedReason))
    .filter((notice): notice is string => Boolean(notice));
  const operationalBlockedCount =
    mission.executionSummary.blockedTasks.length - policyNotices.length;
  const operationalPendingActions =
    mission.executionSummary.pendingActions.filter(
      (action) => !isProviderConfigurationAction(action),
    );
  return (
    <section
      className="output-section"
      id="mission-output"
      aria-labelledby="output-title"
    >
      <div className="section-heading">
        <div>
          <p className="section-number">03</p>
          <h2 id="output-title">Mission output</h2>
        </div>
        <span>{mission.status} / {mission.progress}%</span>
      </div>

      <div className="mission-status-panel">
        <div>
          <p className="panel-label">CURRENT ACTIVITY</p>
          <h3>{mission.currentActivity}</h3>
        </div>
        <div className="mission-meta">
          <span>MISSION ID</span>
          <code>{mission.missionId}</code>
        </div>
        <button
          className="resume-button"
          disabled={isRunning}
          onClick={onResume}
          type="button"
        >
          {isRunning ? "Refreshing..." : "Resume mission"}
        </button>
      </div>

      <div className="progress-track" aria-label={`${mission.progress}% complete`}>
        <span style={{ width: `${mission.progress}%` }} />
      </div>

      <div className="execution-overview">
        <div>
          <span>COMPLETED</span>
          <strong>{mission.executionSummary.completedTasks.length}</strong>
        </div>
        <div>
          <span>NOT AVAILABLE</span>
          <strong>{policyNotices.length}</strong>
        </div>
        <div>
          <span>BLOCKED</span>
          <strong>{Math.max(0, operationalBlockedCount)}</strong>
        </div>
        <div>
          <span>EVIDENCE</span>
          <strong>{mission.executionSummary.evidenceCollected.length}</strong>
        </div>
        <div>
          <span>CONFIDENCE</span>
          <strong>
            {formatConfidence(mission.executionSummary.averageConfidence)}
          </strong>
        </div>
      </div>

      {mission.pendingQuestions.length > 0 && (
        <div className="pending-panel">
          <span>NEXUS NEEDS THESE ANSWERS</span>
          <div>
            {mission.pendingQuestions.map((question) => (
              <p key={question}>{question}</p>
            ))}
          </div>
          <a href="#launch-mission">Add the details above, then resume</a>
        </div>
      )}

      {policyNotices.length > 0 && (
        <div className="provider-policy-panel">
          <span>OPTIONAL PROVIDER POLICY</span>
          <div>
            {[...new Set(policyNotices)].map((notice) => (
              <p key={notice}>{notice}</p>
            ))}
          </div>
        </div>
      )}

      {operationalPendingActions.length > 0 && (
        <div className="pending-actions-panel">
          <span>PENDING ACTIONS TO UNLOCK MORE</span>
          <ul>
            {operationalPendingActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="conversation-panel" aria-labelledby="conversation-title">
        <div className="conversation-heading">
          <div>
            <span>IN-MISSION CONVERSATION</span>
            <h3 id="conversation-title">Refine, correct, or explore</h3>
          </div>
          <small>{mission.conversation.length} persisted messages</small>
        </div>
        <div className="conversation-history" aria-live="polite">
          {mission.conversation.length === 0 ? (
            <p className="panel-empty">
              Ask NEXUS to verify an option, compare evidence, update a mission
              fact, or explain what remains blocked.
            </p>
          ) : (
            mission.conversation.map((message) => (
              <article
                className={`conversation-message is-${message.role.toLowerCase()}`}
                key={message.id}
              >
                <div>
                  <strong>{message.role === "USER" ? "You" : "NEXUS"}</strong>
                  <time>{formatTime(message.createdAt)}</time>
                </div>
                <p>{message.content}</p>
              </article>
            ))
          )}
        </div>
        <form className="conversation-form" onSubmit={onSendMessage}>
          <label>
            <span>CONTINUE THIS MISSION</span>
            <textarea
              value={conversationDraft}
              onChange={(event) =>
                onConversationDraftChange(event.target.value)
              }
              placeholder='Try: "Compare the visa options using official sources" or "Destination is Boston."'
              maxLength={4_000}
              rows={3}
              required
            />
          </label>
          <button
            className="conversation-submit"
            disabled={isRunning || conversationDraft.trim().length === 0}
            type="submit"
          >
            {isRunning ? "Researching..." : "Send to NEXUS"}
          </button>
        </form>
      </section>

      <div className="output-grid">
        <OutputPanel
          className="research-panel"
          eyebrow={`${mission.results.length} EVIDENCE ITEMS`}
          title={labels.evidence}
        >
          <div className="research-list">
            {mission.results.map((result) => (
              <ResearchResult key={result.id} result={result} />
            ))}
          </div>
        </OutputPanel>

        <OutputPanel
          eyebrow={`${mission.recommendations.length} PRIORITIES`}
          title="Recommendations"
        >
          <div className="recommendation-list">
            {mission.recommendations.map((recommendation) => (
              <article className="recommendation" key={recommendation.id}>
                <span>{String(recommendation.rank).padStart(2, "0")}</span>
                <div>
                  <h4>{recommendation.title}</h4>
                  <p>{recommendation.summary}</p>
                  <small>{recommendation.rationale}</small>
                  <button
                    className="explore-button"
                    disabled={isRunning}
                    onClick={() =>
                      onExplore(
                        recommendation.id,
                        `Research and verify more options for: ${recommendation.title}`,
                      )
                    }
                    type="button"
                  >
                    Explore this with NEXUS
                  </button>
                </div>
              </article>
            ))}
          </div>
        </OutputPanel>

        <OutputPanel
          eyebrow={`${mission.tasks.length} NEXT ACTIONS`}
          title={labels.tasks}
        >
          <div className="task-list">
            {mission.tasks.map((task, index) => (
              <div
                className={`task-row ${
                  providerPolicyNotice(task.blockedReason)
                    ? "is-policy-notice"
                    : ""
                }`}
                key={task.id}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{task.title}</strong>
                  <small>
                    {task.capability} /{" "}
                    {providerPolicyNotice(task.blockedReason)
                      ? "NOT AVAILABLE"
                      : task.status.replaceAll("_", " ")}
                  </small>
                  {providerPolicyNotice(task.blockedReason) ? (
                    <p>{providerPolicyNotice(task.blockedReason)}</p>
                  ) : (
                    task.blockedReason && <p>{task.blockedReason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </OutputPanel>

        <OutputPanel eyebrow="PROVIDER-BACKED ONLY" title={labels.budget}>
          <div className="cost-list">
            {mission.costBreakdown.lineItems.map((item) => (
              <div className="cost-row" key={item.id}>
                <div>
                  <strong>{item.category}</strong>
                  {item.notes && <span>{item.notes}</span>}
                </div>
                <b>{formatCurrency(item.amount, item.currency)}</b>
              </div>
            ))}
          </div>
          {mission.costBreakdown.lineItems.length === 0 && (
            <p className="panel-empty">
              No verified price evidence is available yet. NEXUS will not fill
              this section with assumed costs.
            </p>
          )}
          <div className="cost-total">
            <span>ESTIMATED TOTAL</span>
            <strong>
              {formatCurrency(
                mission.costBreakdown.total,
                mission.costBreakdown.currency,
              )}
            </strong>
          </div>
          <p className="disclaimer">{mission.costBreakdown.disclaimer}</p>
        </OutputPanel>

        <OutputPanel
          eyebrow={`${mission.timeline.length} OPERATIONS`}
          title="Mission timeline"
        >
          <div className="timeline-list">
            {mission.timeline.map((entry) => (
              <div className="timeline-entry" key={entry.id}>
                <span>{entry.kind.replaceAll("_", " ")}</span>
                <p>{entry.message}</p>
                <time>{formatTime(entry.occurredAt)}</time>
              </div>
            ))}
          </div>
        </OutputPanel>

        <OutputPanel
          eyebrow={`${mission.notifications.length} UPDATES`}
          title="Agent log"
        >
          <div className="notification-list">
            {mission.notifications.map((notification) => (
              <div className="notification" key={notification.id}>
                <span className="notification-dot" />
                <div>
                  <p>{notification.message}</p>
                  <time>{formatTime(notification.createdAt)}</time>
                </div>
              </div>
            ))}
          </div>
        </OutputPanel>
      </div>
    </section>
  );
}

function OutputPanel({
  eyebrow,
  title,
  className = "",
  children,
}: {
  eyebrow: string;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article className={`output-panel ${className}`}>
      <header>
        <span>{eyebrow}</span>
        <h3>{title}</h3>
      </header>
      {children}
    </article>
  );
}

function providerPolicyNotice(reason: string | null): string | undefined {
  if (reason === "No flight provider configured") {
    return "Not available - NEXUS does not use a paid flight data provider.";
  }
  if (reason === "No airport provider configured") {
    return "Not available - NEXUS does not use a paid airport data provider.";
  }
  if (reason === "No hotel provider configured") {
    return "Not available - NEXUS does not use a paid hotel data provider.";
  }
  return undefined;
}

function isProviderConfigurationAction(action: string): boolean {
  return /provider with the (flights|airports|hotels) capability/i.test(action);
}

function ResearchResult({ result }: { result: A2MCPMissionResult }) {
  if (result.capability === "mission-plan") {
    const focusAreas = stringArray(result.data.workflowCapabilities);
    const preferences = stringArray(result.data.interpretedPreferences);
    return (
      <article className="research-result plan-result">
        <div>
          <p>{result.summary}</p>
          <div className="focus-list">
            {focusAreas.map((focus) => <span key={focus}>{focus}</span>)}
          </div>
          {preferences.length > 0 && (
            <ul className="preference-list">
              {preferences.map((preference) => (
                <li key={preference}>{preference}</li>
              ))}
            </ul>
          )}
          <SourceLine result={result} />
        </div>
      </article>
    );
  }

  if (result.capability === "airports") {
    const origin = airportValue(result.data.origin);
    const destination = airportValue(result.data.destination);
    return (
      <article className="research-result route-result">
        <div>
          <p>{result.summary}</p>
          {origin && destination && (
            <div className="route-line">
              <div>
                <strong>{origin.iataCode}</strong>
                <span>{origin.name}</span>
              </div>
              <b aria-hidden="true">TO</b>
              <div>
                <strong>{destination.iataCode}</strong>
                <span>{destination.name}</span>
              </div>
            </div>
          )}
          <SourceLine result={result} />
        </div>
      </article>
    );
  }

  if (result.capability === "flights") {
    const offers = Array.isArray(result.data.offers)
      ? result.data.offers.filter(isFlightOffer)
      : [];
    return (
      <article className="research-result flight-result">
        <div>
          <p>{result.summary}</p>
          {offers.length > 0 ? (
            <div className="flight-list">
              {offers.slice(0, 5).map((offer) => (
                <div key={offer.id}>
                  <div>
                    <strong>
                      {offer.validatingAirlines.join(" / ") || "Airline"}
                    </strong>
                    <span>
                      {offer.stops === 0
                        ? "Direct"
                        : `${offer.stops} stop${offer.stops === 1 ? "" : "s"}`}
                      {" / "}
                      {offer.duration}
                    </span>
                  </div>
                  <b>{formatCurrency(offer.totalPrice, offer.currency)}</b>
                  <small>{formatFlightSchedule(offer)}</small>
                  <a
                    href={offer.bookingSearchUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Search this route externally
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="provider-note">
              No airfare is shown because NEXUS has no verified live offer to
              display. It will never manufacture a price.
            </p>
          )}
          <SourceLine result={result} />
        </div>
      </article>
    );
  }

  if (result.capability === "hotels") {
    const offers = Array.isArray(result.data.offers)
      ? result.data.offers.filter(isHotelOffer)
      : [];
    return (
      <article className="research-result flight-result">
        <div>
          <p>{result.summary}</p>
          <div className="flight-list">
            {offers.slice(0, 5).map((offer) => (
              <div key={offer.id}>
                <div>
                  <strong>{offer.hotelName}</strong>
                  <span>
                    {offer.checkInDate} to {offer.checkOutDate}
                  </span>
                </div>
                <b>{formatCurrency(offer.totalPrice, offer.currency)}</b>
                {offer.roomDescription && <small>{offer.roomDescription}</small>}
                <a
                  href={offer.bookingSearchUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Search this stay externally
                </a>
              </div>
            ))}
          </div>
          <SourceLine result={result} />
        </div>
      </article>
    );
  }

  if (result.capability === "places") {
    const places = Array.isArray(result.data.places)
      ? result.data.places.filter(isPlace)
      : [];
    return (
      <article className="research-result places-result">
        <div>
          <p>{result.summary}</p>
          <div className="place-list">
            {places.slice(0, 8).map((place, index) => (
              <div key={`${place.title}-${index}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{place.title}</strong>
                <small>{formatDistance(place.distanceMeters)}</small>
              </div>
            ))}
          </div>
          <SourceLine result={result} />
        </div>
      </article>
    );
  }

  if (Array.isArray(result.data.items)) {
    const items = Array.isArray(result.data.items)
      ? result.data.items.filter(isKnowledgeItem)
      : [];
    return (
      <article className="research-result knowledge-result">
        <div>
          <p>{result.summary}</p>
          <div className="knowledge-list">
            {items.map((item, index) => (
              <div key={`${item.title}-${index}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.excerpt}</small>
                  {item.url && (
                    <a href={item.url} rel="noreferrer" target="_blank">
                      Open source
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <SourceLine result={result} />
        </div>
      </article>
    );
  }

  if (result.capability !== "weather") {
    return (
      <article className="research-result plan-result">
        <div>
          <p>{result.summary}</p>
          {result.sourceUrls.length > 0 && (
            <div className="source-links">
              {result.sourceUrls.map((url) => (
                <a href={url} key={url} rel="noreferrer" target="_blank">
                  Open evidence source
                </a>
              ))}
            </div>
          )}
          <SourceLine result={result} />
        </div>
      </article>
    );
  }

  const forecast =
    typeof result.data.forecast === "object" && result.data.forecast !== null
      ? (result.data.forecast as Record<string, unknown>)
      : undefined;
  const temperature =
    typeof forecast?.temperatureMaxC === "number"
      ? `${Math.round(forecast.temperatureMaxC)}°C`
      : "DATE";
  const location = [result.data.location, result.data.country]
    .filter((value): value is string => typeof value === "string")
    .join(", ");
  return (
    <article className="research-result weather-result">
      <div className="weather-reading">
        <strong>{temperature}</strong>
        <span>{location || result.capability}</span>
      </div>
      <div>
        <p>{result.summary}</p>
        <SourceLine result={result} />
      </div>
    </article>
  );
}

function SourceLine({ result }: { result: A2MCPMissionResult }) {
  return (
    <div className="source-line">
      <span>
        {result.providerId} / {formatConfidence(result.confidenceScore)} confidence
      </span>
      <time>{formatTime(result.createdAt)}</time>
    </div>
  );
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isPlace(
  value: unknown,
): value is { title: string; distanceMeters: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { title?: unknown }).title === "string" &&
    typeof (value as { distanceMeters?: unknown }).distanceMeters === "number"
  );
}

function isKnowledgeItem(
  value: unknown,
): value is { title: string; excerpt: string; url?: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { title?: unknown }).title === "string" &&
    typeof (value as { excerpt?: unknown }).excerpt === "string"
  );
}

function airportValue(
  value: unknown,
): { iataCode: string; name: string } | undefined {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { iataCode?: unknown }).iataCode === "string" &&
    typeof (value as { name?: unknown }).name === "string"
  ) {
    return value as { iataCode: string; name: string };
  }
  return undefined;
}

function isFlightOffer(
  value: unknown,
): value is {
  id: string;
  totalPrice: number;
  currency: string;
  validatingAirlines: string[];
  stops: number;
  duration: string;
  bookingSearchUrl: string;
  segments: Array<{
    departureAirport: string;
    departureAt: string;
    arrivalAirport: string;
    arrivalAt: string;
  }>;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { totalPrice?: unknown }).totalPrice === "number" &&
    typeof (value as { currency?: unknown }).currency === "string" &&
    Array.isArray(
      (value as { validatingAirlines?: unknown }).validatingAirlines,
    ) &&
    typeof (value as { stops?: unknown }).stops === "number" &&
    typeof (value as { duration?: unknown }).duration === "string" &&
    typeof (value as { bookingSearchUrl?: unknown }).bookingSearchUrl ===
      "string" &&
    Array.isArray((value as { segments?: unknown }).segments)
  );
}

function isHotelOffer(
  value: unknown,
): value is {
  id: string;
  hotelName: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: number;
  currency: string;
  roomDescription: string | null;
  bookingSearchUrl: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { hotelName?: unknown }).hotelName === "string" &&
    typeof (value as { checkInDate?: unknown }).checkInDate === "string" &&
    typeof (value as { checkOutDate?: unknown }).checkOutDate === "string" &&
    typeof (value as { totalPrice?: unknown }).totalPrice === "number" &&
    typeof (value as { currency?: unknown }).currency === "string" &&
    typeof (value as { bookingSearchUrl?: unknown }).bookingSearchUrl ===
      "string"
  );
}

function formatFlightSchedule(offer: {
  segments: Array<{
    departureAirport: string;
    departureAt: string;
    arrivalAirport: string;
    arrivalAt: string;
  }>;
}): string {
  const first = offer.segments[0];
  const last = offer.segments.at(-1);
  if (!first || !last) return "Schedule unavailable";
  return `${first.departureAirport} ${formatDateTime(first.departureAt)} to ${last.arrivalAirport} ${formatDateTime(last.arrivalAt)}`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDistance(meters: number) {
  return meters < 1000 ? `${meters} m away` : `${(meters / 1000).toFixed(1)} km away`;
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatConfidence(value: number | null) {
  return value === null ? "N/A" : `${Math.round(value * 100)}%`;
}
