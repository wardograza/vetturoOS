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
    communications: communicationState,
    vaultItems: vaultState,
    tasksToday: todayTaskState,
    chatMessages,
    userAccounts,
    inviteRecords,
    configItems,
    actions,
  } = useWorkspaceController();

  const active = personas.find((persona) => persona.id === activePersona)!;
  const metrics = metricCardsByPersona[activePersona];
  const primaryCommunication = communicationState[0];
  const primaryDecision = brandDecisions[0];
  const actionedCount = communicationState.filter((item) => item.status === "Actioned").length;
  const openedCount = communicationState.filter(
    (item) => item.status === "Opened" || item.status === "Read" || item.status === "Clicked",
  ).length;

  const activePageTitle = activePage === "Dashboard" ? "Good morning," : activePage;
  const activePageSubtitle =
    activePage === "Dashboard"
      ? "Thursday, 26 March 2026"
      : `${active.label} view • Thursday, 26 March 2026`;

  const handleTriggerNudges = () => {
    actions.advanceCommunications();
    actions.appendMessages([
      {
        role: "assistant",
        content:
          "I advanced the tracked communications. The latest thread is now visible with opened, read, and escalation state so you can review before final action.",
      },
    ]);
    setActivePage("Communications");
  };

  const handleApproveVault = () => {
    const changed = vaultState.some((item) => item.status === "Pending Approval");
    actions.approveNextVaultItem();
    actions.appendMessages([
      {
        role: "assistant",
        content: changed
          ? "I approved the next pending document for core memory. It can now be used as verified source material."
          : "The approval queue is clear. There are no pending memory items right now.",
      },
    ]);
    setActivePage("Approvals");
  };

  const handleCreateIncident = () => {
    actions.createIncident();
    actions.appendMessages([
      {
        role: "assistant",
        content:
          "I created a new operational task, routed it to Facilities, and assigned it to the lowest-load eligible owner. Department-head review can happen next if needed.",
      },
    ]);
    setActivePage("Tasks");
  };

  const handleRevenueRecovery = () => {
    actions.appendMessages([
      {
        role: "assistant",
        content:
          "Revenue recovery workflow initiated. Finance now has a lease-backed escalation pack, and the highest-value communication thread is visible with opened, read, and action tracking.",
      },
    ]);
    setActivePersona("finance");
    setActivePage("Revenue");
  };

  const handleBotSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = botInput.trim();
    if (!prompt) return;

    actions.appendUserMessage(prompt);
    setBotInput("");

    const resolution = resolveBotPrompt(prompt, {
      activePersona,
      activePage,
      communications: communicationState,
      vaultItems: vaultState,
      tasksToday: todayTaskState,
    });

    if (resolution.activePage) {
      setActivePage(resolution.activePage);
    }

    if (resolution.activePersona) {
      setActivePersona(resolution.activePersona);
    }

    if (resolution.communications) {
      actions.appendMessages([]);
    }

    if (resolution.vaultItems) {
      actions.appendMessages([]);
    }

    if (resolution.tasksToday) {
      actions.appendMessages([]);
    }

    if (resolution.communications) {
      void actions.advanceCommunications();
    }

    if (resolution.vaultItems) {
      void actions.approveNextVaultItem();
    }

    if (resolution.tasksToday) {
      void actions.createIncident();
    }

    actions.appendMessages(resolution.messages);
  };

  const renderDashboard = () => (
    <>
      <section className="hero hero-minimal">
        <div className="hero-lead">
          <p className="eyebrow">{active.label}</p>
          <h3>{active.title}</h3>
          <p className="hero-copy">{active.focus}</p>
        </div>
        <div className="hero-cta">
          <strong>{active.heroMetric}</strong>
          <span>{active.heroValue}</span>
          <p>{active.summary}</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={handleRevenueRecovery}>
              Let Vetturo act
            </button>
            <button className="secondary-button" onClick={handleCreateIncident}>
              Report issue
            </button>
          </div>
        </div>
      </section>

      <section className="overview-grid">
        {metrics.map((metric) => (
          <article className="overview-card" key={metric.id}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small className={`tone ${metric.tone}`}>{metric.change}</small>
          </article>
        ))}
      </section>

      <section className="task-grid">
        <article className="surface-card">
          <div className="panel-header">
            <div>
              <p className="section-label">Today’s Tasks ({todayTaskState.length})</p>
              <h3>Priority work</h3>
            </div>
            <button className="ghost-button" onClick={handleCreateIncident}>
              New incident
            </button>
          </div>
          <div className="task-stack">
            {todayTaskState.map((task) => (
              <div className="task-row" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <p>
                    {task.department} • {task.assignee}
                  </p>
                </div>
                <div className="task-meta">
                  <span>{task.status}</span>
                  <small>{task.slaDue}</small>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface-card">
          <div className="panel-header">
            <div>
              <p className="section-label">Spill-over Tasks ({spilloverTasks.length})</p>
              <h3>Backlog</h3>
            </div>
            <button className="ghost-button" onClick={() => setActivePage("Tasks")}>
              View all
            </button>
          </div>
          <div className="task-stack">
            {spilloverTasks.map((task) => (
              <div className="task-row" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <p>
                    {task.department} • {task.assignee}
                  </p>
                </div>
                <div className="task-meta">
                  <span>{task.status}</span>
                  <small>{task.slaDue}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="surface-card emphasis">
          <div className="panel-header">
            <div>
              <p className="section-label">Live communication</p>
              <h3>{primaryCommunication.subject}</h3>
            </div>
            <button className="ghost-button" onClick={handleTriggerNudges}>
              Advance thread
            </button>
          </div>
          <p className="lead-copy">
            {primaryCommunication.recipient} • {primaryCommunication.channel} •{" "}
            {primaryCommunication.purpose}
          </p>
          <div className="communication-summary single">
            <div>
              <span>Status</span>
              <strong>{primaryCommunication.status}</strong>
            </div>
            <div>
              <span>SLA</span>
              <strong>{primaryCommunication.sla}</strong>
            </div>
            <div>
              <span>Escalation</span>
              <strong>{primaryCommunication.escalation}</strong>
            </div>
          </div>
          <div className="event-row">
            {primaryCommunication.events.map((event) => (
              <span
                key={`${primaryCommunication.id}-${event.label}`}
                className={event.complete ? "event-pill complete" : "event-pill"}
              >
                {event.label}
              </span>
            ))}
          </div>
        </article>

        <article className="surface-card">
          <div className="panel-header">
            <div>
              <p className="section-label">Action queue</p>
              <h3>What needs attention</h3>
            </div>
          </div>
          <div className="signal-stack">
            {alerts.slice(0, 3).map((alert) => (
              <div className="signal-row" key={alert.id}>
                <span className={`pill ${alert.severity.toLowerCase()}`}>{alert.severity}</span>
                <div>
                  <strong>{alert.title}</strong>
                  <p>{alert.nextAction}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface-card">
          <div className="panel-header">
            <div>
              <p className="section-label">Document vault</p>
              <h3>Memory staging area</h3>
            </div>
            <button className="ghost-button" onClick={() => setActivePage("Document Vault")}>
              Open vault
            </button>
          </div>
          <div className="signal-stack">
            {vaultState.slice(0, 3).map((item) => (
              <div className="signal-row compact" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <p>
                    {item.type} • {item.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface-card">
          <div className="panel-header">
            <div>
              <p className="section-label">Leasing signal</p>
              <h3>{primaryDecision.brand}</h3>
            </div>
          </div>
          <p className="lead-copy">{primaryDecision.recommendation}</p>
          <div className="mini-metrics">
            <div>
              <span>Score</span>
              <strong>{primaryDecision.suitability}</strong>
            </div>
            <div>
              <span>Risk</span>
              <strong>{primaryDecision.cannibalizationRisk}</strong>
            </div>
          </div>
        </article>
      </section>
    </>
  );

  const renderPageContent = () => {
    if (activePage === "Dashboard") {
      return renderDashboard();
    }

    if (activePage === "Tasks") {
      return (
        <section className="single-page-grid">
          <article className="surface-card">
            <div className="panel-header">
              <div>
                <p className="section-label">Task workspace</p>
                <h3>Operational queue</h3>
              </div>
              <button className="ghost-button" onClick={handleCreateIncident}>
                New incident
              </button>
            </div>
            <div className="task-stack">
              {todayTaskState.concat(spilloverTasks).map((task) => (
                <div className="task-row" key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    <p>
                      {task.department} • {task.assignee}
                    </p>
                  </div>
                  <div className="task-meta">
                    <span>{task.status}</span>
                    <small>{task.slaDue}</small>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      );
    }

    if (activePage === "Communications" || activePage === "Revenue") {
      return (
        <section className="single-page-grid">
          <article className="surface-card">
            <div className="panel-header">
              <div>
                <p className="section-label">
                  {activePage === "Revenue" ? "Revenue recovery" : "Tracked communications"}
                </p>
                <h3>
                  {activePage === "Revenue"
                    ? "Recovery threads and escalations"
                    : "Status and audit trail"}
                </h3>
              </div>
              <button className="ghost-button" onClick={handleTriggerNudges}>
                Advance thread
              </button>
            </div>
            <div className="signal-stack">
              {communicationState.map((comm) => (
                <div className="signal-row expanded" key={comm.id}>
                  <div>
                    <strong>{comm.subject}</strong>
                    <p>
                      {comm.recipient} • {comm.channel} • {comm.purpose}
                    </p>
                    <div className="event-row">
                      {comm.events.map((event) => (
                        <span
                          key={`${comm.id}-${event.label}`}
                          className={event.complete ? "event-pill complete" : "event-pill"}
                        >
                          {event.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="task-meta">
                    <span>{comm.status}</span>
                    <small>{comm.sla}</small>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      );
    }

    if (activePage === "Leasing") {
      return (
        <section className="single-page-grid">
          <article className="surface-card">
            <div className="panel-header">
              <div>
                <p className="section-label">Leasing intelligence</p>
                <h3>Brand suitability board</h3>
              </div>
            </div>
            <div className="signal-stack">
              {brandDecisions.map((decision) => (
                <div className="signal-row expanded" key={decision.brand}>
                  <div>
                    <strong>{decision.brand}</strong>
                    <p>{decision.recommendation}</p>
                  </div>
                  <div className="mini-metrics compact">
                    <div>
                      <span>Score</span>
                      <strong>{decision.suitability}</strong>
                    </div>
                    <div>
                      <span>Risk</span>
                      <strong>{decision.cannibalizationRisk}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      );
    }

    if (activePage === "Document Vault") {
      return (
        <section className="single-page-grid">
          <article className="surface-card">
            <div className="panel-header">
              <div>
                <p className="section-label">Document vault</p>
                <h3>Core memory staging area</h3>
              </div>
              <button className="ghost-button">Upload PDF or Excel</button>
            </div>
            <div className="signal-stack">
              {vaultState.map((item) => (
                <div className="signal-row" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <p>
                      {item.type} • {item.owner}
                    </p>
                  </div>
                  <div className="task-meta">
                    <span>{item.status}</span>
                    <small>
                      {item.status === "Approved for Core Memory"
                        ? "Available to the bot"
                        : "Blocked from truth layer"}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      );
    }

    if (activePage === "Approvals") {
      return (
        <section className="single-page-grid">
          <article className="surface-card">
            <div className="panel-header">
              <div>
                <p className="section-label">Approval queue</p>
                <h3>Pending memory approvals</h3>
              </div>
              <button className="ghost-button" onClick={handleApproveVault}>
                Approve next
              </button>
            </div>
            <div className="signal-stack">
              {vaultState.map((item) => (
                <div className="signal-row" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <p>
                      {item.type} • {item.owner}
                    </p>
                  </div>
                  <div className="task-meta">
                    <span>{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      );
    }

    if (activePage === "Permissions") {
      return (
        <section className="single-page-grid">
          <article className="surface-card">
            <div className="panel-header">
              <div>
                <p className="section-label">Permissions</p>
                <h3>Role and invite controls</h3>
              </div>
              <button className="ghost-button" onClick={() => void actions.createInvite()}>
                Send invite
              </button>
            </div>
            <div className="signal-stack">
              {userAccounts.map((user) => (
                <div className="signal-row" key={user.id}>
                  <div>
                    <strong>{user.fullName}</strong>
                    <p>
                      {user.email} • {user.role}
                    </p>
                  </div>
                  <div className="task-meta">
                    <span>{user.status}</span>
                    <small>{user.mustResetPassword ? "Password reset pending" : "Access active"}</small>
                  </div>
                </div>
              ))}
              {inviteRecords.map((invite) => (
                <div className="signal-row" key={invite.id}>
                  <div>
                    <strong>{invite.email}</strong>
                    <p>
                      {invite.role} • Invited by {invite.invitedBy}
                    </p>
                  </div>
                  <div className="task-meta">
                    <span>{invite.status}</span>
                    <small>Expires {invite.expiresAt}</small>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      );
    }

    return (
      <section className="single-page-grid">
        <article className="surface-card">
          <div className="panel-header">
            <div>
              <p className="section-label">Configurations</p>
              <h3>System and provider settings</h3>
            </div>
          </div>
          <div className="signal-stack">
            {configItems.map((item) => (
              <div className="signal-row" key={item.id}>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.description}</p>
                </div>
                <div className="task-meta">
                  <span>{item.status}</span>
                  <small>{item.label === "Backend mode" ? backendMode : item.value}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    );
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div>
            <p className="eyebrow">Vetturo</p>
            <h1>{activePage}</h1>
          </div>
          <button className="icon-button" aria-label="Open navigation">
            ≡
          </button>
        </div>

        <nav className="sidebar-nav">
          {navigationItems.map((item) => (
            <button
              key={item}
              className={item === activePage ? "nav-item active" : "nav-item"}
              type="button"
              onClick={() => setActivePage(item)}
            >
              <span className="nav-dot" />
              <span>{item}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="user-chip" type="button">
            <span className="avatar-dot">V</span>
            <span>{active.label}</span>
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <section className="topbar">
          <div>
            <h2>{activePageTitle}</h2>
            <p className="topbar-subtitle">{activePageSubtitle}</p>
          </div>
          <div className="topbar-actions">
            <div className="persona-strip">
              {personas.map((persona) => (
                <button
                  key={persona.id}
                  className={persona.id === activePersona ? "persona-tab active" : "persona-tab"}
                  onClick={() => setActivePersona(persona.id)}
                >
                  {persona.label}
                </button>
              ))}
            </div>
            <button className="icon-button" aria-label="Notifications">
              ◌
            </button>
          </div>
        </section>

        {renderPageContent()}
      </main>

      <section className={copilotOpen ? "copilot open" : "copilot"}>
        <button className="copilot-toggle" onClick={() => setCopilotOpen((open) => !open)}>
          {copilotOpen ? "Minimize Vetturo" : "Open Vetturo"}
        </button>
        {copilotOpen ? (
          <>
            <div className="copilot-header">
              <div>
                <p className="section-label">AI copilot</p>
                <h3>Chief of Staff</h3>
              </div>
              <span className="status-dot">
                {openedCount} opened • {actionedCount} actioned
              </span>
            </div>
            <div className="copilot-priority">
              <strong>Recommended next move</strong>
              <p>
                Ask Vetturo to create, assign, escalate, vet, approve, or review. The bot should be
                your primary interaction surface, not just a static side panel.
              </p>
            </div>
            <div className="chat-thread">
              {chatMessages.slice(-4).map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={message.role === "assistant" ? "message assistant" : "message user"}
                >
                  <span>{message.role === "assistant" ? "Vetturo" : "You"}</span>
                  <p>{message.content}</p>
                </div>
              ))}
            </div>
            <form className="chat-input-row" onSubmit={handleBotSubmit}>
              <input
                className="chat-input"
                value={botInput}
                onChange={(event) => setBotInput(event.target.value)}
                placeholder="Example: create a facilities task, approve the next document, or vet a new brand"
              />
              <button className="primary-button" type="submit">
                Send
              </button>
            </form>
            <div className="action-stack">
              <button className="primary-button" onClick={handleRevenueRecovery}>
                Initiate revenue recovery
              </button>
              <button className="secondary-button" onClick={handleApproveVault}>
                Clear next approval
              </button>
              <button className="secondary-button" onClick={handleCreateIncident}>
                Create routed incident
              </button>
              <button className="secondary-button" onClick={handleTriggerNudges}>
                Advance communication ladder
              </button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

export default App;
