import {
  brandDecisions,
  metricCardsByPersona,
  personas,
} from "./data";

function App() {
  const activePersona = "mall_manager";

  const active =
    personas.find((p) => p.id === activePersona) || personas[0];

  const metrics = metricCardsByPersona[activePersona] || [];

  const primaryCommunication = {
    subject: "Escalation on unresolved common-area issue",
    recipient: "Tenant",
    channel: "WhatsApp",
    status: "Pending",
    events: [{ label: "Sent" }, { label: "Opened" }],
  };

  const primaryDecision =
    brandDecisions && brandDecisions.length > 0
      ? brandDecisions[0]
      : {
          brand: "No data",
          recommendation: "No recommendation available",
        };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <h2>Vetturo</h2>
        <p>{active?.label}</p>
      </aside>

      {/* Main */}
      <main className="main-content">
        <h1>Dashboard</h1>

        {/* Metrics */}
        <section className="metrics">
          {metrics.map((metric: any) => (
            <div className="metric-card" key={metric.id}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </section>

        {/* Communication */}
        <section className="card">
          <h3>{primaryCommunication.subject}</h3>
          <p>
            {primaryCommunication.recipient} •{" "}
            {primaryCommunication.channel}
          </p>
          <strong>{primaryCommunication.status}</strong>

          <div className="events">
            {primaryCommunication.events.map((e, i) => (
              <span key={i}>{e.label}</span>
            ))}
          </div>
        </section>

        {/* Brand Decision */}
        <section className="card">
          <h3>{primaryDecision.brand}</h3>
          <p>{primaryDecision.recommendation}</p>
        </section>
      </main>
    </div>
  );
}

export default App;
