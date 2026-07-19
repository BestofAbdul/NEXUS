const missionTypes = [
  { label: "Travel", code: "TRV", detail: "Plan a trip with confidence" },
  { label: "Relocate", code: "RLC", detail: "Move countries or cities" },
  { label: "Study Abroad", code: "STD", detail: "Navigate study options" },
  { label: "Buy / Rent", code: "HME", detail: "Find the right property" },
  { label: "New Job", code: "JOB", detail: "Plan your next career move" },
  { label: "Plan an Event", code: "EVT", detail: "Coordinate every detail" },
  { label: "Medical Trip", code: "MED", detail: "Prepare care and travel" },
  { label: "Move Goods", code: "LOG", detail: "Research a logistics route" },
  { label: "Custom Mission", code: "CUS", detail: "Start from your own goal" },
];

export default function MissionControl() {
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
          A2MCP agent ready
        </div>
      </header>

      <section className="mission-hero">
        <div className="hero-index">A2MCP / AGENT SERVICE PROVIDER</div>
        <div className="hero-grid">
          <div>
            <p className="eyebrow">NEXUS AUTONOMOUS MISSION AGENT</p>
            <h1>Goals in. Mission-ready plans out.</h1>
          </div>
          <p className="hero-note">
            This is the operator control plane for a callable agent. NEXUS
            creates persistent missions, coordinates MCP tools, and returns
            machine-readable progress and recommendations.
          </p>
        </div>
      </section>

      <section className="mission-section" aria-labelledby="mission-types-title">
        <div className="section-heading">
          <div>
            <p className="section-number">01</p>
            <h2 id="mission-types-title">Supported mission intents</h2>
          </div>
          <span>CALLABLE CAPABILITIES</span>
        </div>

        <div className="mission-grid">
          {missionTypes.map((mission, index) => (
            <article className="mission-card" key={mission.code}>
              <div className="card-topline">
                <span>{mission.code}</span>
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
              <div>
                <h3>{mission.label}</h3>
                <p>{mission.detail}</p>
              </div>
              <span className="card-arrow" aria-hidden="true">
                {"\u2197"}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="active-section" aria-labelledby="active-title">
        <div className="section-heading">
          <div>
            <p className="section-number">02</p>
            <h2 id="active-title">Agent runs</h2>
          </div>
          <span>0 IN PROGRESS</span>
        </div>
        <div className="empty-state">
          <span className="empty-symbol">+</span>
          <div>
            <h3>No active agent runs.</h3>
            <p>
              Invoke NEXUS with a goal. A persistent mission is created and
              research begins before non-blocking questions are asked.
            </p>
          </div>
          <span className="phase-label">ASP CORE / PHASE 1 READY</span>
        </div>
      </section>
    </main>
  );
}
