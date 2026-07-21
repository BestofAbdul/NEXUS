"use client";

import { useState, type FormEvent } from "react";
import type {
  A2MCPMissionResponse,
  A2MCPMissionResult,
  MissionType,
} from "@nexus/shared";

const missionTypes: Array<{
  label: string;
  type: MissionType;
  code: string;
  detail: string;
  goal: string;
}> = [
  {
    label: "Travel",
    type: "TRAVEL",
    code: "TRV",
    detail: "Research weather, priorities, and a practical trip budget.",
    goal: "Plan a five-day trip to Tokyo",
  },
  {
    label: "Relocate",
    type: "RELOCATE",
    code: "RLC",
    detail: "Build a structured path for moving countries or cities.",
    goal: "Research relocation options for Canada",
  },
  {
    label: "Study Abroad",
    type: "STUDY_ABROAD",
    code: "STD",
    detail: "Navigate destinations, requirements, and preparation.",
    goal: "Plan my path to study abroad",
  },
  {
    label: "Buy / Rent",
    type: "BUY_RENT_PROPERTY",
    code: "HME",
    detail: "Organize property research and trade-offs.",
    goal: "Research the best place to rent a home",
  },
  {
    label: "New Job",
    type: "NEW_JOB",
    code: "JOB",
    detail: "Turn a career target into a focused mission.",
    goal: "Prepare for a senior engineering job search",
  },
  {
    label: "Plan an Event",
    type: "PLAN_EVENT",
    code: "EVT",
    detail: "Coordinate priorities, timing, and costs.",
    goal: "Plan a memorable community event",
  },
  {
    label: "Medical Trip",
    type: "MEDICAL_TRIP",
    code: "MED",
    detail: "Prepare non-clinical travel and logistics research.",
    goal: "Prepare the logistics for a medical trip",
  },
  {
    label: "Move Goods",
    type: "MOVE_GOODS",
    code: "LOG",
    detail: "Research a route and organize shipping decisions.",
    goal: "Research how to move goods internationally",
  },
  {
    label: "Custom Mission",
    type: "CUSTOM",
    code: "CUS",
    detail: "Start a persistent mission from your own goal.",
    goal: "",
  },
];

interface ApiError {
  error?: {
    code?: string;
    message?: string;
  };
}

export default function MissionControl() {
  const [missionType, setMissionType] = useState<MissionType>("TRAVEL");
  const [goal, setGoal] = useState("Plan a five-day trip to Tokyo");
  const [destination, setDestination] = useState("Tokyo");
  const [dates, setDates] = useState("");
  const [purpose, setPurpose] = useState("Leisure");
  const [mission, setMission] = useState<A2MCPMissionResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");

  function selectMission(type: MissionType, suggestedGoal: string) {
    setMissionType(type);
    if (suggestedGoal) {
      setGoal(suggestedGoal);
    }
    setError("");
    document
      .getElementById("launch-mission")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function runMission(event?: FormEvent, resume = false) {
    event?.preventDefault();
    setIsRunning(true);
    setError("");

    try {
      const context = Object.fromEntries(
        Object.entries({ destination, dates, purpose }).filter(
          ([, value]) => value.trim().length > 0,
        ),
      );
      const response = await fetch("/api/a2mcp/mission", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          goal: goal.trim(),
          missionType,
          missionId: resume ? mission?.missionId : undefined,
          context,
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
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
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
            <h1>Give us the goal. We build the mission.</h1>
          </div>
          <div className="hero-aside">
            <p>
              NEXUS researches, reasons, recommends, and tracks a real persistent
              mission. It never pays or books. You stay in control.
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
          <span>TRAVEL PATH FULLY LIVE</span>
        </div>

        <div className="mission-grid">
          {missionTypes.map((missionOption, index) => (
            <button
              className={`mission-card ${
                missionType === missionOption.type ? "is-selected" : ""
              }`}
              key={missionOption.code}
              onClick={() =>
                selectMission(missionOption.type, missionOption.goal)
              }
              type="button"
            >
              <span className="card-topline">
                <span>{missionOption.code}</span>
                <span>{String(index + 1).padStart(2, "0")}</span>
              </span>
              <span className="card-copy">
                <strong>{missionOption.label}</strong>
                <span>{missionOption.detail}</span>
              </span>
              <span className="card-arrow" aria-hidden="true">
                ↗
              </span>
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
            <h2 id="launch-title">Mission brief</h2>
          </div>
          <span>{missionType.replaceAll("_", " ")}</span>
        </div>

        <div className="launch-layout">
          <div className="launch-intro">
            <p className="launch-kicker">WHAT HAPPENS NEXT</p>
            <h3>Research starts as soon as you submit.</h3>
            <p>
              I&apos;ll create a persistent mission, run the relevant agent
              workflow, and return the evidence, recommendations, and planning
              costs here.
            </p>
            <ol>
              <li><span>01</span> Mission created</li>
              <li><span>02</span> MCP research called</li>
              <li><span>03</span> Advice and costs synthesized</li>
            </ol>
          </div>

          <form className="mission-form" onSubmit={(event) => runMission(event)}>
            <label className="goal-field">
              <span>MISSION GOAL</span>
              <textarea
                name="goal"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder="What do you want to accomplish?"
                required
                rows={3}
              />
            </label>
            <div className="context-grid">
              <label>
                <span>DESTINATION</span>
                <input
                  name="destination"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  placeholder="Tokyo"
                />
              </label>
              <label>
                <span>DATES</span>
                <input
                  name="dates"
                  value={dates}
                  onChange={(event) => setDates(event.target.value)}
                  placeholder="Flexible"
                />
              </label>
              <label>
                <span>PURPOSE</span>
                <input
                  name="purpose"
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                  placeholder="Leisure"
                />
              </label>
            </div>
            {error && (
              <div className="form-error" role="alert">
                <span>REQUEST FAILED</span>
                {error}
              </div>
            )}
            <button className="launch-button" disabled={isRunning} type="submit">
              <span>{isRunning ? "Agents are working" : "Start mission"}</span>
              <span aria-hidden="true">{isRunning ? "•••" : "→"}</span>
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
            <span>AWAITING BRIEF</span>
          </div>
          <div className="empty-state">
            <span className="empty-symbol">+</span>
            <div>
              <h3>Your mission dashboard will appear here.</h3>
              <p>
                Submit the brief above to run the live NEXUS agent service.
              </p>
            </div>
            <span className="phase-label">API + MCP ONLINE</span>
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
          {isRunning ? "Refreshing…" : "Resume mission"}
        </button>
      </div>

      <div className="progress-track" aria-label={`${mission.progress}% complete`}>
        <span style={{ width: `${mission.progress}%` }} />
      </div>

      <div className="output-grid">
        <OutputPanel
          className="research-panel"
          eyebrow={`${mission.results.length} VERIFIED RESULT${
            mission.results.length === 1 ? "" : "S"
          }`}
          title="Research"
        >
          {mission.results.length > 0 ? (
            mission.results.map((result) => (
              <ResearchResult key={result.id} result={result} />
            ))
          ) : (
            <PanelEmpty message="No research result is available for this mission type yet." />
          )}
        </OutputPanel>

        <OutputPanel
          eyebrow={`${mission.recommendations.length} PRIORITIES`}
          title="Recommendations"
        >
          {mission.recommendations.length > 0 ? (
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
          ) : (
            <PanelEmpty message="Recommendations will appear when this agent path is available." />
          )}
        </OutputPanel>

        <OutputPanel
          eyebrow="INFORMATIONAL ONLY"
          title="Planning budget"
        >
          {mission.costBreakdown.lineItems.length > 0 ? (
            <>
              <div className="cost-list">
                {mission.costBreakdown.lineItems.map((item) => (
                  <div className="cost-row" key={item.id}>
                    <div>
                      <strong>{item.category}</strong>
                      {item.notes && <span>{item.notes}</span>}
                    </div>
                    <b>
                      {formatCurrency(item.amount, item.currency)}
                    </b>
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
              <p className="disclaimer">
                {mission.costBreakdown.disclaimer}
              </p>
            </>
          ) : (
            <PanelEmpty message="No planning costs have been generated for this mission." />
          )}
        </OutputPanel>

        <OutputPanel
          eyebrow={`${mission.notifications.length} UPDATES`}
          title="Agent log"
        >
          {mission.notifications.length > 0 ? (
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
          ) : (
            <PanelEmpty message="Agent updates will be recorded here." />
          )}
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
  children: React.ReactNode;
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
  const temperature =
    typeof result.data.temperatureC === "number"
      ? `${Math.round(result.data.temperatureC)}°C`
      : null;
  const location = [result.data.location, result.data.country]
    .filter((value): value is string => typeof value === "string")
    .join(", ");

  return (
    <article className="research-result">
      <div className="weather-reading">
        <strong>{temperature ?? "LIVE"}</strong>
        <span>{location || result.capability}</span>
      </div>
      <div>
        <p>{result.summary}</p>
        <div className="source-line">
          <span>{result.providerId}</span>
          <time>{formatTime(result.createdAt)}</time>
        </div>
      </div>
    </article>
  );
}

function PanelEmpty({ message }: { message: string }) {
  return <p className="panel-empty">{message}</p>;
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
