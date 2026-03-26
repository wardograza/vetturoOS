import { useState } from "react";
import {
  alerts,
  brandDecisions,
  metricCardsByPersona,
  personas,
} from "./data";
import type { PersonaId } from "./types";

function App() {
  const [activePersona, setActivePersona] = useState<PersonaId>("mall_manager");

  const active = personas.find((p) => p.id === activePersona) || personas[0];
  const metrics = metricCardsByPersona[activePersona] || [];

  // SAFE FALLBACK DATA (prevents crashes)
  const safeCommunications = [
    {
      subject: "No communication available",
      recipient: "—",
      channel: "—",
      status: "—",
      events: [],
    },
  ];

  const communications = safeCommunications;

  const primaryCommunication = communications[0];

  const primaryDecision =
    brandDecisions?.[0] || {
      brand: "No data",
      recommendation: "No recommendation available",
    };

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "sans-serif" }}>
      
      {/* Sidebar */}
      <aside style={{ width: 200, background: "#111", color: "#fff", padding: 20 }}>
        <h3>Vetturo</h3>
        <p>{active?.label || "User"}</p>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: 20 }}>
        <h2>Dashboard</h2>

        {/* Metrics */}
        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          {metrics.map((m) => (
            <div
              key={m.id}
              style={{
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 8,
                minWidth: 120,
              }}
            >
              <div>{m.label}</div>
              <strong>{m.value}</strong>
            </div>
          ))}
        </div>

        {/* Communication Card */}
        <div style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8 }}>
          <h3>{primaryCommunication.subject}</h3>
          <p>
            {primaryCommunication.recipient} • {primaryCommunication.channel}
          </p>
          <strong>{primaryCommunication.status}</strong>
        </div>

        {/* Decision Card */}
        <div
          style={{
            border: "1px solid #ddd",
            padding: 16,
            borderRadius: 8,
            marginTop: 20,
          }}
        >
          <h3>{primaryDecision.brand}</h3>
          <p>{primaryDecision.recommendation}</p>
        </div>
      </main>
    </div>
  );
}

export default App;
