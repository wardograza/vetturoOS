import { useState } from "react";
import {
alerts,
brandDecisions,
metricCardsByPersona,
personas,
spilloverTasks,
} from "./data";
import type { PersonaId } from "./types";
import { NavPage, resolveBotPrompt } from "./lib/botEngine";
import { useWorkspaceController } from "./hooks/useWorkspaceController";
import { backendMode } from "./lib/supabase";

function App() {
const navigationItems: NavPage[] = [
"Dashboard",
"Tasks",
"Communications",
"Revenue",
"Leasing",
"Document Vault",
"Approvals",
"Permissions",
"Configs",
];

const [activePersona, setActivePersona] = useState<PersonaId>("mall_manager");
const [activePage, setActivePage] = useState<NavPage>("Dashboard");
const [copilotOpen, setCopilotOpen] = useState(true);
const [botInput, setBotInput] = useState("");

const {
communications: communicationState = [],
vaultItems: vaultState = [],
tasksToday: todayTaskState = [],
chatMessages = [],
userAccounts = [],
inviteRecords = [],
configItems = [],
actions,
} = useWorkspaceController();

const active = personas.find((p) => p.id === activePersona) || personas[0];
const metrics = metricCardsByPersona[activePersona] || [];

const primaryCommunication = communicationState?.[0] || null;
const primaryDecision = brandDecisions?.[0] || null;

const actionedCount = communicationState?.filter((i) => i?.status === "Actioned")?.length || 0;
const openedCount =
communicationState?.filter(
(i) => i?.status === "Opened" || i?.status === "Read" || i?.status === "Clicked",
)?.length || 0;

const activePageTitle = activePage === "Dashboard" ? "Good morning," : activePage;

const renderDashboard = () => (
<> <section className="overview-grid">
{metrics?.map((metric) => ( <article className="overview-card" key={metric.id}> <span>{metric.label}</span> <strong>{metric.value}</strong> </article>
))} </section>

```
  <section className="dashboard-grid">
    <article className="surface-card emphasis">
      <h3>{primaryCommunication?.subject || "No subject"}</h3>

      <p>
        {primaryCommunication?.recipient || "Unknown"} •{" "}
        {primaryCommunication?.channel || "N/A"}
      </p>

      <div>
        <strong>{primaryCommunication?.status || "N/A"}</strong>
      </div>

      <div>
        {primaryCommunication?.events?.map((event) => (
          <span key={event.label}>{event.label}</span>
        )) || "No events"}
      </div>
    </article>

    <article className="surface-card">
      <h3>{primaryDecision?.brand || "No brand data"}</h3>
      <p>{primaryDecision?.recommendation || "No recommendation"}</p>
    </article>
  </section>
</>
```

);

return ( <div className="app-shell"> <aside className="sidebar">
{navigationItems.map((item) => (
<button key={item} onClick={() => setActivePage(item)}>
{item} </button>
))} </aside>

```
  <main>
    <h2>{activePageTitle}</h2>
    {renderDashboard()}
  </main>

  {copilotOpen && (
    <section>
      {chatMessages?.map((msg, i) => (
        <p key={i}>{msg.content}</p>
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBotInput("");
        }}
      >
        <input value={botInput} onChange={(e) => setBotInput(e.target.value)} />
        <button type="submit">Send</button>
      </form>
    </section>
  )}
</div>
```

);
}

export default App;
