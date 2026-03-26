import { FormEvent, useEffect, useMemo, useState } from "react";
import { fetchWorkspaceData } from "./lib/workspace";
import type {
  CommunicationRecord,
  DecisionDnaRecord,
  DocumentRecord,
  NavPage,
  Tenant,
  WorkspaceData,
} from "./types";

interface BotMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
}

const navItems: NavPage[] = [
  "Overview",
  "Tenants",
  "Revenue",
  "Tasks",
  "Communications",
  "Document Vault",
  "Leasing",
  "Approvals",
  "Permissions",
  "Configs",
];

const pageDescriptions: Record<NavPage, string> = {
  Overview: "The operating layer across revenue, escalations, approvals, and active risk.",
  Tenants: "Live tenant roster from Supabase with unit-level rent visibility.",
  Revenue: "Revenue intelligence, leakage checks, and recoverability signals excluding billing workflows.",
  Tasks: "Incident intake, assignment visibility, SLA tracking, and completion workflow.",
  Communications: "Status tracking for bot-driven internal and external communication threads.",
  "Document Vault": "Approved and pending documents for the AI memory layer and data extraction workflows.",
  Leasing: "Decision DNA, brand fit signals, adjacency reasoning, and technical feasibility.",
  Approvals: "Super admin review surface for memory admissions and action approvals.",
  Permissions: "Invite-only access model, role visibility, and password-reset governance.",
  Configs: "System readiness across AI memory, comms providers, and rollout controls.",
};

const initialMessages: BotMessage[] = [
  {
    id: "assistant-1",
    role: "assistant",
    text:
      "I can route you through the workspace. Ask me to open revenue, review approvals, inspect communication status, vet a brand, or summarize document readiness.",
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function daysUntil(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const distance = parsed.getTime() - Date.now();
  return Math.round(distance / (1000 * 60 * 60 * 24));
}

function extractTableName(warning: string) {
  const separatorIndex = warning.indexOf(":");
  return separatorIndex === -1 ? warning : warning.slice(0, separatorIndex);
}

function toTitleCase(value: string) {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

function getCommunicationBadge(status: string) {
  const normalized = status.toLowerCase();

  if (["actioned", "resolved", "completed"].includes(normalized)) {
    return "good";
  }

  if (["failed", "bounced", "overdue"].includes(normalized)) {
    return "bad";
  }

  if (["escalated", "opened", "read", "clicked"].includes(normalized)) {
    return "warn";
  }

  return "neutral";
}

function getTaskBadge(status: string | null) {
  const normalized = (status ?? "").toLowerCase();

  if (["closed", "completed"].includes(normalized)) {
    return "good";
  }

  if (["awaiting approval", "awaiting proof", "reopened"].includes(normalized)) {
    return "warn";
  }

  return "neutral";
}

function getDocumentBadge(status: string) {
  const normalized = status.toLowerCase();

  if (["approved", "active"].includes(normalized)) {
    return "good";
  }

  if (["pending", "processing", "review"].includes(normalized)) {
    return "warn";
  }

  return "neutral";
}

function renderSetupState(
  title: string,
  description: string,
  warning?: string,
  suggestion?: string,
) {
  return (
    <section className="state-card">
      <h3>{title}</h3>
      <p>{description}</p>
      {warning ? <p className="state-meta">Current status: {warning}</p> : null}
      {suggestion ? <p className="state-meta">Next step: {suggestion}</p> : null}
    </section>
  );
}

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<NavPage>("Overview");
  const [botMessages, setBotMessages] = useState<BotMessage[]>(initialMessages);
  const [botInput, setBotInput] = useState("");
  const [isBotOpen, setIsBotOpen] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      setLoading(true);
      setFatalError(null);

      try {
        const data = await fetchWorkspaceData();

        if (!active) {
          return;
        }

        setWorkspace(data);
      } catch (error) {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : "Unknown loading error";
        setFatalError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      active = false;
    };
  }, []);

  const warnings = workspace?.warnings ?? [];

  const setupWarnings = useMemo(() => {
    const warningMap = new Map<string, string>();

    warnings.forEach((warning) => {
      warningMap.set(extractTableName(warning), warning);
    });

    return warningMap;
  }, [warnings]);

  const summary = useMemo(() => {
    const data = workspace;

    if (!data) {
      return {
        totalRent: 0,
        averageRent: 0,
        highestRentTenant: null as Tenant | null,
        activeTasks: 0,
        pendingApprovals: 0,
        openThreads: 0,
        actionedThreads: 0,
        coreMemoryDocs: 0,
        pendingDocs: 0,
        brandsReviewed: 0,
      };
    }

    const totalRent = data.tenants.reduce((sum, tenant) => sum + tenant.rent, 0);
    const averageRent = data.tenants.length > 0 ? totalRent / data.tenants.length : 0;
    const highestRentTenant = data.tenants.reduce<Tenant | null>(
      (highest, tenant) => (!highest || tenant.rent > highest.rent ? tenant : highest),
      null,
    );
    const activeTasks = data.tasks.filter(
      (task) => !["closed", "completed"].includes((task.status ?? "").toLowerCase()),
    ).length;
    const pendingApprovals = data.documents.filter((document) =>
      ["pending", "review", "processing"].includes(document.status.toLowerCase()),
    ).length;
    const openThreads = data.communications.filter((thread) =>
      !["actioned", "resolved", "completed"].includes(thread.current_status.toLowerCase()),
    ).length;
    const actionedThreads = data.communications.filter((thread) =>
      ["actioned", "resolved", "completed"].includes(thread.current_status.toLowerCase()),
    ).length;
    const coreMemoryDocs = data.documents.filter((document) => document.is_in_core_memory).length;
    const pendingDocs = data.documents.filter((document) => !document.is_in_core_memory).length;
    const brandsReviewed = data.decisionDna.length;

    return {
      totalRent,
      averageRent,
      highestRentTenant,
      activeTasks,
      pendingApprovals,
      openThreads,
      actionedThreads,
      coreMemoryDocs,
      pendingDocs,
      brandsReviewed,
    };
  }, [workspace]);

  const topTenants = useMemo(
    () => [...(workspace?.tenants ?? [])].sort((left, right) => right.rent - left.rent).slice(0, 8),
    [workspace],
  );

  const revenueRiskTenants = useMemo(
    () => [...(workspace?.tenants ?? [])].sort((left, right) => right.rent - left.rent).slice(0, 5),
    [workspace],
  );

  const tasksByPriority = useMemo(
    () =>
      [...(workspace?.tasks ?? [])].sort((left, right) =>
        String(left.priority ?? "").localeCompare(String(right.priority ?? "")),
      ),
    [workspace],
  );

  const communicationThreads = useMemo(
    () =>
      [...(workspace?.communications ?? [])].sort((left, right) =>
        String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")),
      ),
    [workspace],
  );

  const documents = workspace?.documents ?? [];
  const decisionDna = workspace?.decisionDna ?? [];
  const profiles = workspace?.profiles ?? [];
  const invites = workspace?.invites ?? [];

  const pageTitle = activePage === "Overview" ? "Mall operating system" : activePage;

  const pageKicker =
    activePage === "Overview" ? "MVP Workspace" : activePage === "Document Vault" ? "AI Memory" : "Workspace";

  function addBotMessage(message: BotMessage) {
    setBotMessages((current) => [...current, message]);
  }

  function replyFromAssistant(text: string) {
    addBotMessage({
      id: `assistant-${Date.now()}`,
      role: "assistant",
      text,
    });
  }

  function handleBotSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = botInput.trim();

    if (!trimmed) {
      return;
    }

    addBotMessage({
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    });

    const normalized = trimmed.toLowerCase();

    if (normalized.includes("revenue")) {
      setActivePage("Revenue");
      replyFromAssistant(
        "Opened Revenue. This view surfaces rent concentration, top-value tenants, and recoverability-focused signals without invoice collection.",
      );
    } else if (normalized.includes("task") || normalized.includes("incident")) {
      setActivePage("Tasks");
      replyFromAssistant(
        "Opened Tasks. Department heads can manage assignment, SLA, and proof-optional completion from this workspace.",
      );
    } else if (
      normalized.includes("communication") ||
      normalized.includes("email") ||
      normalized.includes("whatsapp") ||
      normalized.includes("escalat")
    ) {
      setActivePage("Communications");
      replyFromAssistant(
        "Opened Communications. This page tracks sent, delivered, opened, actioned, escalated, failed, and other thread states across bot-triggered outreach.",
      );
    } else if (
      normalized.includes("vault") ||
      normalized.includes("document") ||
      normalized.includes("memory")
    ) {
      setActivePage("Document Vault");
      replyFromAssistant(
        "Opened Document Vault. Unapproved files should be visible but not trusted by the AI memory layer until super admin review is complete.",
      );
    } else if (
      normalized.includes("approve") ||
      normalized.includes("review") ||
      normalized.includes("super admin")
    ) {
      setActivePage("Approvals");
      replyFromAssistant(
        "Opened Approvals. This is where memory admission, review queues, and final human confirmation belong.",
      );
    } else if (
      normalized.includes("brand") ||
      normalized.includes("leasing") ||
      normalized.includes("dna")
    ) {
      setActivePage("Leasing");
      replyFromAssistant(
        "Opened Leasing. Decision DNA is ready for category fit, technical feasibility, and cannibalization review as those records come online.",
      );
    } else if (
      normalized.includes("permission") ||
      normalized.includes("invite") ||
      normalized.includes("user")
    ) {
      setActivePage("Permissions");
      replyFromAssistant(
        "Opened Permissions. This workspace covers invite-only access, super admin controls, and first-login password reset governance.",
      );
    } else if (
      normalized.includes("config") ||
      normalized.includes("provider") ||
      normalized.includes("setting")
    ) {
      setActivePage("Configs");
      replyFromAssistant(
        "Opened Configs. Use this area to track environment readiness across Supabase, AI memory, email, and WhatsApp rollout.",
      );
    } else {
      setActivePage("Overview");
      replyFromAssistant(
        "I can route you to Revenue, Tasks, Communications, Document Vault, Leasing, Approvals, Permissions, or Configs. The UI is wired around those MVP workflows now.",
      );
    }

    setBotInput("");
  }

  function renderOverview() {
    return (
      <>
        <section className="hero-grid">
          <article className="hero-card">
            <p className="section-kicker">Detect and Execute</p>
            <h3>Revenue, approvals, tasks, and communications in one operator view.</h3>
            <p>
              The current MVP excludes invoice collection from brands, but keeps the rest of the
              mall operating model visible and backend-ready.
            </p>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => setActivePage("Document Vault")}>
                Review memory inputs
              </button>
              <button className="secondary-button" onClick={() => setActivePage("Communications")}>
                Track communication status
              </button>
            </div>
          </article>

          <article className="panel spotlight-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">At A Glance</p>
                <h3>Operator health</h3>
              </div>
            </div>
            <div className="spotlight-list">
              <div>
                <span>Active tasks</span>
                <strong>{summary.activeTasks}</strong>
              </div>
              <div>
                <span>Open threads</span>
                <strong>{summary.openThreads}</strong>
              </div>
              <div>
                <span>Pending approvals</span>
                <strong>{summary.pendingApprovals}</strong>
              </div>
              <div>
                <span>Core memory docs</span>
                <strong>{summary.coreMemoryDocs}</strong>
              </div>
            </div>
          </article>
        </section>

        <section className="metrics-grid four-up">
          <article className="metric-card">
            <span>Monthly Rent Base</span>
            <strong>{formatCompactCurrency(summary.totalRent)}</strong>
            <small>From live tenant rent values</small>
          </article>
          <article className="metric-card">
            <span>Avg. Rent</span>
            <strong>{formatCompactCurrency(summary.averageRent)}</strong>
            <small>Current tenant portfolio average</small>
          </article>
          <article className="metric-card">
            <span>Decision DNA Records</span>
            <strong>{summary.brandsReviewed}</strong>
            <small>Brand vetting entries available</small>
          </article>
          <article className="metric-card">
            <span>Actioned Threads</span>
            <strong>{summary.actionedThreads}</strong>
            <small>Comms closed with action</small>
          </article>
        </section>

        <section className="content-grid balanced">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Revenue Signals</p>
                <h3>High-value tenants</h3>
              </div>
              <button className="text-button" onClick={() => setActivePage("Revenue")}>
                Open revenue
              </button>
            </div>
            <div className="tenant-list">
              {topTenants.length > 0 ? (
                topTenants.slice(0, 4).map((tenant) => (
                  <div className="tenant-row" key={`${tenant.tenantName}-${tenant.unitNumber}`}>
                    <div>
                      <strong>{tenant.tenantName}</strong>
                      <p>Unit {tenant.unitNumber}</p>
                    </div>
                    <span>{formatCurrency(tenant.rent)}</span>
                  </div>
                ))
              ) : (
                <div className="empty-row">No tenant rows available yet.</div>
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Communications</p>
                <h3>Status ladder</h3>
              </div>
              <button className="text-button" onClick={() => setActivePage("Communications")}>
                Open communications
              </button>
            </div>
            {communicationThreads.length > 0 ? (
              <div className="thread-list">
                {communicationThreads.slice(0, 4).map((thread) => (
                  <div className="thread-card" key={thread.id}>
                    <div className="thread-topline">
                      <strong>{thread.recipient_name}</strong>
                      <span className={`badge ${getCommunicationBadge(thread.current_status)}`}>
                        {thread.current_status}
                      </span>
                    </div>
                    <p>{thread.purpose}</p>
                    <small>
                      {toTitleCase(thread.channel)} • SLA {formatDate(thread.sla_due_at)}
                    </small>
                  </div>
                ))}
              </div>
            ) : (
              renderSetupState(
                "Communication tracking is ready",
                "Once the communications table is populated, this area will show email and WhatsApp status progression for bot-led outreach.",
                setupWarnings.get("communications"),
                "Apply the communications schema and start persisting thread events.",
              )
            )}
          </article>
        </section>

        <section className="content-grid balanced">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Document Vault</p>
                <h3>Memory readiness</h3>
              </div>
              <button className="text-button" onClick={() => setActivePage("Document Vault")}>
                Open vault
              </button>
            </div>
            <div className="mini-stats">
              <div>
                <span>Pending review</span>
                <strong>{summary.pendingDocs}</strong>
              </div>
              <div>
                <span>In core memory</span>
                <strong>{summary.coreMemoryDocs}</strong>
              </div>
            </div>
            <p className="panel-copy">
              Uploaded documents should remain visible to operators even before approval, but the
              AI must not use them as trusted memory until a super admin admits them.
            </p>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Leasing Intelligence</p>
                <h3>Decision DNA</h3>
              </div>
              <button className="text-button" onClick={() => setActivePage("Leasing")}>
                Open leasing
              </button>
            </div>
            {decisionDna.length > 0 ? (
              <div className="insights-list">
                {decisionDna.slice(0, 3).map((record) => (
                  <div className="insight-card" key={record.id}>
                    <span>{record.candidate_brand_name}</span>
                    <strong>{record.recommendation}</strong>
                    <p>
                      Score {record.total_score} • {record.category} • Cannibalization{" "}
                      {record.cannibalization_risk}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              renderSetupState(
                "Decision DNA is empty",
                "This view is reserved for new-brand scoring, adjacency logic, and technical fit once leasing evaluations are stored.",
                setupWarnings.get("decision_dna_scores"),
                "Start writing brand review records into decision_dna_scores.",
              )
            )}
          </article>
        </section>
      </>
    );
  }

  function renderTenants() {
    return (
      <section className="content-grid balanced">
        <article className="panel wide-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Tenant Registry</p>
              <h3>Live portfolio</h3>
            </div>
          </div>
          <div className="tenant-list">
            {topTenants.length > 0 ? (
              topTenants.concat(workspace?.tenants.slice(8, 20) ?? []).map((tenant) => (
                <div className="tenant-row" key={`${tenant.tenantName}-${tenant.unitNumber}`}>
                  <div>
                    <strong>{tenant.tenantName}</strong>
                    <p>Unit {tenant.unitNumber}</p>
                  </div>
                  <span>{formatCurrency(tenant.rent)}</span>
                </div>
              ))
            ) : (
              <div className="empty-row">No tenants are currently available.</div>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Portfolio Summary</p>
              <h3>Tenant insights</h3>
            </div>
          </div>
          <div className="insights-list">
            <div className="insight-card">
              <span>Total tenants</span>
              <strong>{workspace?.tenants.length ?? 0}</strong>
              <p>Current tenant rows available from Supabase.</p>
            </div>
            <div className="insight-card">
              <span>Highest rent tenant</span>
              <strong>{summary.highestRentTenant?.tenantName ?? "No data"}</strong>
              <p>
                {summary.highestRentTenant
                  ? `${formatCurrency(summary.highestRentTenant.rent)} • Unit ${summary.highestRentTenant.unitNumber}`
                  : "No tenant data available yet."}
              </p>
            </div>
            <div className="insight-card">
              <span>Billing status</span>
              <strong>Deferred</strong>
              <p>Invoice collection from brands is intentionally excluded from this sprint.</p>
            </div>
          </div>
        </article>
      </section>
    );
  }

  function renderRevenue() {
    return (
      <>
        <section className="metrics-grid four-up">
          <article className="metric-card">
            <span>Total rent base</span>
            <strong>{formatCurrency(summary.totalRent)}</strong>
            <small>Active tenant rents only</small>
          </article>
          <article className="metric-card">
            <span>Average tenant rent</span>
            <strong>{formatCurrency(summary.averageRent)}</strong>
            <small>Useful for outlier detection</small>
          </article>
          <article className="metric-card">
            <span>Top tenant concentration</span>
            <strong>
              {summary.totalRent > 0 && revenueRiskTenants.length > 0
                ? `${Math.round(
                    (revenueRiskTenants.reduce((sum, tenant) => sum + tenant.rent, 0) /
                      summary.totalRent) *
                      100,
                  )}%`
                : "0%"}
            </strong>
            <small>Share of rent in top five tenants</small>
          </article>
          <article className="metric-card">
            <span>Billing collection</span>
            <strong>Deferred</strong>
            <small>Moved to future sprint by request</small>
          </article>
        </section>

        <section className="content-grid balanced">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Recoverability Desk</p>
                <h3>High-value rent exposure</h3>
              </div>
            </div>
            <div className="tenant-list">
              {revenueRiskTenants.length > 0 ? (
                revenueRiskTenants.map((tenant) => (
                  <div className="tenant-row" key={`${tenant.tenantName}-${tenant.unitNumber}`}>
                    <div>
                      <strong>{tenant.tenantName}</strong>
                      <p>Unit {tenant.unitNumber}</p>
                    </div>
                    <span>{formatCurrency(tenant.rent)}</span>
                  </div>
                ))
              ) : (
                <div className="empty-row">Revenue insights need tenant rows to appear.</div>
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">MVP Scope Note</p>
                <h3>What is included now</h3>
              </div>
            </div>
            <div className="insights-list">
              <div className="insight-card">
                <span>Included</span>
                <strong>Revenue intelligence</strong>
                <p>Rent visibility, top-value exposure, and recoverability framing remain active.</p>
              </div>
              <div className="insight-card">
                <span>Excluded</span>
                <strong>Invoice collection</strong>
                <p>Tenant or brand billing collection is intentionally held back for future sprints.</p>
              </div>
              <div className="insight-card">
                <span>Next data unlock</span>
                <strong>Budgets and lease rules</strong>
                <p>Adding structured lease and budget memory will sharpen anomaly and escalation logic.</p>
              </div>
            </div>
          </article>
        </section>
      </>
    );
  }

  function renderTasks() {
    if (setupWarnings.has("tasks") && tasksByPriority.length === 0) {
      return renderSetupState(
        "Tasks workspace is ready for live data",
        "This page expects routed incidents, assignments, SLA dates, and approval states from the tasks table.",
        setupWarnings.get("tasks"),
        "Apply the tasks schema, then persist incidents from the bot or manual operations flow.",
      );
    }

    return (
      <section className="content-grid balanced">
        <article className="panel wide-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Task Lifecycle</p>
              <h3>Open and in-flight work</h3>
            </div>
          </div>
          <div className="thread-list">
            {tasksByPriority.length > 0 ? (
              tasksByPriority.map((task) => (
                <div className="thread-card" key={task.id}>
                  <div className="thread-topline">
                    <strong>{task.title}</strong>
                    <span className={`badge ${getTaskBadge(task.status)}`}>{task.status ?? "Open"}</span>
                  </div>
                  <p>
                    {task.department ?? "Unassigned department"} • Priority {task.priority ?? "Not set"}
                  </p>
                  <small>
                    SLA {formatDate(task.sla_due_at)} • Proof {task.proof_required ? "optional" : "not required"}
                  </small>
                </div>
              ))
            ) : (
              <div className="empty-row">No tasks have been recorded yet.</div>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Assignment Rules</p>
              <h3>MVP workflow</h3>
            </div>
          </div>
          <div className="insights-list">
            <div className="insight-card">
              <span>Lifecycle</span>
              <strong>Open → Assigned → In Progress → Awaiting Approval → Closed</strong>
              <p>Optional Awaiting Proof and Reopened states still fit this model.</p>
            </div>
            <div className="insight-card">
              <span>Assignment</span>
              <strong>Department-led</strong>
              <p>Department heads should control assignment while the bot routes incidents into the right queue.</p>
            </div>
            <div className="insight-card">
              <span>Proof</span>
              <strong>Optional</strong>
              <p>Attachment proof remains optional and most relevant for facilities workflows.</p>
            </div>
          </div>
        </article>
      </section>
    );
  }

  function renderCommunications() {
    if (setupWarnings.has("communications") && communicationThreads.length === 0) {
      return renderSetupState(
        "Communication tracking is not live yet",
        "This page is designed for internal and external bot-led outreach with full lifecycle tracking.",
        setupWarnings.get("communications"),
        "Persist communication rows and webhook status events for email and WhatsApp.",
      );
    }

    return (
      <section className="content-grid balanced">
        <article className="panel wide-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Thread Status</p>
              <h3>Outbound communications</h3>
            </div>
          </div>
          <div className="thread-list">
            {communicationThreads.length > 0 ? (
              communicationThreads.map((thread) => (
                <CommunicationRow key={thread.id} thread={thread} />
              ))
            ) : (
              <div className="empty-row">No communication threads have been logged yet.</div>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Status Model</p>
              <h3>Tracked states</h3>
            </div>
          </div>
          <div className="status-grid">
            {["Queued", "Sent", "Delivered", "Opened", "Read", "Clicked", "Actioned", "Escalated", "Failed"].map(
              (status) => (
                <span className={`badge ${getCommunicationBadge(status)}`} key={status}>
                  {status}
                </span>
              ),
            )}
          </div>
          <p className="panel-copy">
            Every bot-triggered internal or external communication should land here with lifecycle
            visibility and escalation history.
          </p>
        </article>
      </section>
    );
  }

  function renderDocumentVault() {
    if (setupWarnings.has("documents") && documents.length === 0) {
      return renderSetupState(
        "Document Vault is waiting for records",
        "This area is for leases, budgets, KYC, and licenses. Uploaded documents can exist before approval but must not enter AI core memory until reviewed.",
        setupWarnings.get("documents"),
        "Apply the documents schema and begin storing parsed file metadata from uploads.",
      );
    }

    return (
      <section className="content-grid balanced">
        <article className="panel wide-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Vault</p>
              <h3>Document inventory</h3>
            </div>
          </div>
          <div className="thread-list">
            {documents.length > 0 ? (
              documents.map((document) => (
                <DocumentRow key={document.id} document={document} />
              ))
            ) : (
              <div className="empty-row">No documents have been uploaded yet.</div>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Policy</p>
              <h3>Memory admission</h3>
            </div>
          </div>
          <div className="insights-list">
            <div className="insight-card">
              <span>Unapproved docs</span>
              <strong>Visible, not trusted</strong>
              <p>The AI can acknowledge their existence but should not use them as truth.</p>
            </div>
            <div className="insight-card">
              <span>Super admin controls</span>
              <strong>Edit both raw and structured memory</strong>
              <p>Operators should be able to refine extracted fields and underlying memory text.</p>
            </div>
            <div className="insight-card">
              <span>Accepted formats</span>
              <strong>PDF and Excel</strong>
              <p>Images and scans are intentionally deferred for the first pass.</p>
            </div>
          </div>
        </article>
      </section>
    );
  }

  function renderLeasing() {
    if (setupWarnings.has("decision_dna_scores") && decisionDna.length === 0) {
      return renderSetupState(
        "Leasing intelligence is waiting for scored brands",
        "Decision DNA will surface category fit, adjacency logic, technical compatibility, and cannibalization risk here.",
        setupWarnings.get("decision_dna_scores"),
        "Begin writing candidate-brand evaluations into decision_dna_scores.",
      );
    }

    return (
      <section className="content-grid balanced">
        <article className="panel wide-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Decision DNA</p>
              <h3>Brand vetting</h3>
            </div>
          </div>
          <div className="thread-list">
            {decisionDna.length > 0 ? (
              decisionDna.map((record) => <DecisionRow key={record.id} record={record} />)
            ) : (
              <div className="empty-row">No leasing evaluations have been stored yet.</div>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Scoring Model</p>
              <h3>MVP assumptions</h3>
            </div>
          </div>
          <div className="insights-list">
            <div className="insight-card">
              <span>Weights</span>
              <strong>Fixed for MVP</strong>
              <p>Configurable scoring can come later after the base model proves reliable.</p>
            </div>
            <div className="insight-card">
              <span>Technical fit</span>
              <strong>Feasibility first</strong>
              <p>Power, gas, and unit readiness should be treated as hard gating checks.</p>
            </div>
            <div className="insight-card">
              <span>Decision support</span>
              <strong>Human review required</strong>
              <p>Use the AI for synthesis and evidence, with a final human approval step.</p>
            </div>
          </div>
        </article>
      </section>
    );
  }

  function renderApprovals() {
    const pendingDocuments = documents.filter((document) =>
      ["pending", "review", "processing"].includes(document.status.toLowerCase()),
    );

    if (setupWarnings.has("documents") && documents.length === 0) {
      return renderSetupState(
        "Approvals depend on vault records",
        "This queue is designed for super admin review before memory becomes active.",
        setupWarnings.get("documents"),
        "Populate documents first, then use this queue for review and approval states.",
      );
    }

    return (
      <section className="content-grid balanced">
        <article className="panel wide-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Approval Queue</p>
              <h3>Needs super admin review</h3>
            </div>
          </div>
          <div className="thread-list">
            {pendingDocuments.length > 0 ? (
              pendingDocuments.map((document) => <DocumentRow key={document.id} document={document} />)
            ) : (
              <div className="empty-row">No pending approvals right now.</div>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Review Rule</p>
              <h3>Required before AI memory</h3>
            </div>
          </div>
          <div className="insights-list">
            <div className="insight-card">
              <span>Approval gate</span>
              <strong>Non-negotiable</strong>
              <p>Nothing enters core memory before review, even if parsing has finished successfully.</p>
            </div>
            <div className="insight-card">
              <span>Edit control</span>
              <strong>Structured + raw</strong>
              <p>Super admins should be able to correct extracted values and the stored memory basis.</p>
            </div>
          </div>
        </article>
      </section>
    );
  }

  function renderPermissions() {
    return (
      <section className="content-grid balanced">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Users</p>
              <h3>Role visibility</h3>
            </div>
          </div>
          {setupWarnings.has("profiles") && profiles.length === 0 ? (
            renderSetupState(
              "Profiles are not live yet",
              "This page expects operator profiles with roles and first-login password reset state.",
              setupWarnings.get("profiles"),
              "Apply the profiles schema and connect invite acceptance to profile creation.",
            )
          ) : (
            <div className="thread-list">
              {profiles.length > 0 ? (
                profiles.map((profile) => (
                  <div className="thread-card" key={profile.id}>
                    <div className="thread-topline">
                      <strong>{profile.full_name}</strong>
                      <span className={`badge ${profile.is_active ? "good" : "neutral"}`}>
                        {profile.role}
                      </span>
                    </div>
                    <p>{profile.email}</p>
                    <small>
                      Password reset {profile.must_reset_password ? "required" : "completed"} •{" "}
                      {profile.is_active ? "Active" : "Inactive"}
                    </small>
                  </div>
                ))
              ) : (
                <div className="empty-row">No user profiles are visible yet.</div>
              )}
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Invites</p>
              <h3>Invite-only access</h3>
            </div>
          </div>
          {setupWarnings.has("user_invites") && invites.length === 0 ? (
            renderSetupState(
              "Invite records are not live yet",
              "Only super admins should be able to issue invites in the MVP.",
              setupWarnings.get("user_invites"),
              "Apply user_invites and connect invite creation to super admin workflows.",
            )
          ) : (
            <div className="thread-list">
              {invites.length > 0 ? (
                invites.map((invite) => (
                  <div className="thread-card" key={invite.id}>
                    <div className="thread-topline">
                      <strong>{invite.email}</strong>
                      <span className={`badge ${invite.accepted_at ? "good" : "warn"}`}>
                        {invite.role}
                      </span>
                    </div>
                    <p>{invite.accepted_at ? "Accepted" : "Pending acceptance"}</p>
                    <small>Expires {formatDate(invite.expires_at)}</small>
                  </div>
                ))
              ) : (
                <div className="empty-row">No invites have been issued yet.</div>
              )}
            </div>
          )}
        </article>
      </section>
    );
  }

  function renderConfigs() {
    const configurationItems = [
      {
        name: "Supabase workspace",
        status: "Live",
        description: "Tenant data is already flowing from Supabase into the operator dashboard.",
      },
      {
        name: "AI memory gate",
        status: documents.length > 0 ? "Visible" : "Pending setup",
        description: "Documents should remain visible before approval but blocked from trusted memory.",
      },
      {
        name: "Email provider",
        status: communicationThreads.length > 0 ? "Tracking active" : "Needs connection",
        description: "Provider webhooks should update sent, delivered, opened, and actioned states.",
      },
      {
        name: "WhatsApp provider",
        status: communicationThreads.some((thread) => thread.channel.toLowerCase() === "whatsapp")
          ? "Tracking active"
          : "Needs connection",
        description: "Use the same communication ledger for escalations and external brand outreach.",
      },
      {
        name: "Billing collection",
        status: "Deferred",
        description: "Tenant invoice collection is excluded from this sprint by product decision.",
      },
    ];

    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">System Readiness</p>
            <h3>Configs and rollout controls</h3>
          </div>
        </div>
        <div className="thread-list">
          {configurationItems.map((item) => (
            <div className="thread-card" key={item.name}>
              <div className="thread-topline">
                <strong>{item.name}</strong>
                <span
                  className={`badge ${
                    item.status === "Live" || item.status === "Tracking active"
                      ? "good"
                      : item.status === "Deferred"
                        ? "neutral"
                        : "warn"
                  }`}
                >
                  {item.status}
                </span>
              </div>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderActivePage() {
    switch (activePage) {
      case "Overview":
        return renderOverview();
      case "Tenants":
        return renderTenants();
      case "Revenue":
        return renderRevenue();
      case "Tasks":
        return renderTasks();
      case "Communications":
        return renderCommunications();
      case "Document Vault":
        return renderDocumentVault();
      case "Leasing":
        return renderLeasing();
      case "Approvals":
        return renderApprovals();
      case "Permissions":
        return renderPermissions();
      case "Configs":
        return renderConfigs();
      default:
        return renderOverview();
    }
  }

  return (
    <div className="workspace-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <p className="sidebar-kicker">Vetturo OS</p>
          <h1>Mall Operating System</h1>
          <p className="sidebar-copy">
            Bot-first operations for revenue visibility, leasing, tasks, communications, approvals,
            and AI memory.
          </p>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              className={`nav-button ${item === activePage ? "active" : ""}`}
              key={item}
              onClick={() => setActivePage(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="footer-label">MVP scope</span>
          <strong>Billing collection excluded</strong>
          <p>Everything else is being wired around the live Supabase workspace.</p>
        </div>
      </aside>

      <main className="main-panel">
        <header className="page-header">
          <div>
            <p className="page-kicker">{pageKicker}</p>
            <h2>{pageTitle}</h2>
            <p className="page-copy">{pageDescriptions[activePage]}</p>
          </div>
          <div className="header-actions">
            <button className="secondary-button" onClick={() => setActivePage("Overview")}>
              Command center
            </button>
            <button className="primary-button" onClick={() => setIsBotOpen((current) => !current)}>
              {isBotOpen ? "Minimize Vetturo" : "Open Vetturo"}
            </button>
          </div>
        </header>

        {loading ? (
          <section className="state-card">
            <h3>Loading workspace…</h3>
            <p>Pulling tenant, task, communication, vault, leasing, and permissions state from Supabase.</p>
          </section>
        ) : fatalError ? (
          <section className="state-card error">
            <h3>Workspace failed to load</h3>
            <p>{fatalError}</p>
          </section>
        ) : (
          <>
            {warnings.length > 0 ? (
              <section className="warning-banner">
                <strong>Setup items still pending</strong>
                <p>
                  Live data is flowing where tables exist. The remaining MVP modules are showing
                  setup-safe states until their schema and data are live.
                </p>
              </section>
            ) : null}

            {renderActivePage()}
          </>
        )}
      </main>

      {isBotOpen ? (
        <aside className="bot-panel">
          <div className="bot-header">
            <div>
              <p className="panel-kicker">Vetturo</p>
              <h3>Operator Copilot</h3>
            </div>
            <button className="icon-button" onClick={() => setIsBotOpen(false)} type="button">
              Minimize
            </button>
          </div>

          <div className="bot-body">
            {botMessages.map((message) => (
              <div className={`bot-message ${message.role}`} key={message.id}>
                {message.text}
              </div>
            ))}
          </div>

          <div className="bot-shortcuts">
            {["Open revenue", "Review approvals", "Check communication status", "Open document vault"].map(
              (shortcut) => (
                <button
                  className="shortcut-button"
                  key={shortcut}
                  onClick={() => setBotInput(shortcut)}
                  type="button"
                >
                  {shortcut}
                </button>
              ),
            )}
          </div>

          <form className="bot-form" onSubmit={handleBotSubmit}>
            <textarea
              className="bot-input"
              onChange={(event) => setBotInput(event.target.value)}
              placeholder="Ask Vetturo to open revenue, review approvals, inspect communications, or summarize setup status."
              rows={3}
              value={botInput}
            />
            <button className="primary-button full-width" type="submit">
              Send to Vetturo
            </button>
          </form>
        </aside>
      ) : (
        <button className="bot-launcher" onClick={() => setIsBotOpen(true)} type="button">
          V
        </button>
      )}
    </div>
  );
}

function CommunicationRow({ thread }: { thread: CommunicationRecord }) {
  const remainingDays = daysUntil(thread.sla_due_at);

  return (
    <div className="thread-card">
      <div className="thread-topline">
        <strong>{thread.subject || thread.purpose}</strong>
        <span className={`badge ${getCommunicationBadge(thread.current_status)}`}>{thread.current_status}</span>
      </div>
      <p>
        {thread.recipient_name} • {toTitleCase(thread.channel)} • Escalation level {thread.escalation_level}
      </p>
      <small>
        {thread.requires_action ? "Action required" : "FYI thread"} • SLA {formatDate(thread.sla_due_at)}
        {remainingDays !== null ? ` • ${remainingDays >= 0 ? `${remainingDays}d left` : `${Math.abs(remainingDays)}d overdue`}` : ""}
      </small>
    </div>
  );
}

function DocumentRow({ document }: { document: DocumentRecord }) {
  return (
    <div className="thread-card">
      <div className="thread-topline">
        <strong>{document.file_name}</strong>
        <span className={`badge ${getDocumentBadge(document.status)}`}>{document.status}</span>
      </div>
      <p>
        {toTitleCase(document.document_type)} •{" "}
        {document.is_in_core_memory ? "In trusted memory" : "Blocked from trusted memory"}
      </p>
      <small>{document.parser_summary || `Uploaded ${formatDate(document.uploaded_at)}`}</small>
    </div>
  );
}

function DecisionRow({ record }: { record: DecisionDnaRecord }) {
  return (
    <div className="thread-card">
      <div className="thread-topline">
        <strong>{record.candidate_brand_name}</strong>
        <span className={`badge ${record.recommendation.toLowerCase().includes("go") ? "good" : "warn"}`}>
          {record.recommendation}
        </span>
      </div>
      <p>
        {record.category} • Total score {record.total_score}
      </p>
      <small>
        Synergy {record.category_synergy} • Technical fit {record.technical_fit} • Financial{" "}
        {record.financial_health} • Cannibalization {record.cannibalization_risk}
      </small>
    </div>
  );
}

export default App;
