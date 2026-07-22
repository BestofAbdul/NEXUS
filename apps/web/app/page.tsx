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
    detail: "Discover places, conditions, priorities, and a practical budget.",
    goal: "Plan a trip around my interests, time, and budget",
    setupTitle: "Shape the trip you actually want.",
    setupDescription:
      "NEXUS will check live destination conditions, find notable nearby places, and turn your preferences into a route and readiness plan.",
    fields: [
      { key: "destination", label: "Destination", placeholder: "Tokyo" },
      { key: "dates", label: "Travel dates", placeholder: "October 10-15" },
      { key: "duration", label: "Number of days", placeholder: "5" },
      { key: "travelers", label: "Travelers", placeholder: "1" },
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
      destination: "Tokyo",
      duration: "5",
      travelers: "1",
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

export default function MissionControl() {
  const initial = missionOptions[0];
  const [selected, setSelected] = useState<MissionOption>(initial);
  const [goal, setGoal] = useState(initial.goal);
  const [context, setContext] = useState<Record<string, string>>(
    initial.defaults,
  );
  const [mission, setMission] = useState<A2MCPMissionResponse | null>(null);
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

  async function runMission(event?: FormEvent, resume = false) {
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
          context: cleanContext,
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
                      name={field.key}
                      value={context[field.key] ?? ""}
                      onChange={(event) =>
                        updateContext(field.key, event.target.value)
                      }
                      placeholder={field.placeholder}
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
}: {
  mission: A2MCPMissionResponse;
  isRunning: boolean;
  onResume: () => void;
}) {
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

      <div className="output-grid">
        <OutputPanel
          className="research-panel"
          eyebrow={`${mission.results.length} EVIDENCE ITEMS`}
          title="What NEXUS learned"
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
                </div>
              </article>
            ))}
          </div>
        </OutputPanel>

        <OutputPanel
          eyebrow={`${mission.tasks.length} NEXT ACTIONS`}
          title="Mission tasks"
        >
          <div className="task-list">
            {mission.tasks.map((task, index) => (
              <div className="task-row" key={task.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{task.title}</strong>
                  <small>{task.status.replaceAll("_", " ")}</small>
                </div>
              </div>
            ))}
          </div>
        </OutputPanel>

        <OutputPanel eyebrow="INFORMATIONAL ONLY" title="Planning budget">
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

function ResearchResult({ result }: { result: A2MCPMissionResult }) {
  if (result.capability === "mission-plan") {
    const focusAreas = stringArray(result.data.focusAreas);
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

  if (result.capability === "knowledge") {
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
                </div>
              </div>
            ))}
          </div>
          <SourceLine result={result} />
        </div>
      </article>
    );
  }

  const temperature =
    typeof result.data.temperatureC === "number"
      ? `${Math.round(result.data.temperatureC)}°C`
      : "LIVE";
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
      <span>{result.providerId}</span>
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
): value is { title: string; excerpt: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { title?: unknown }).title === "string" &&
    typeof (value as { excerpt?: unknown }).excerpt === "string"
  );
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
