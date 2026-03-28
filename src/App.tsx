import { FormEvent, useEffect, useMemo, useState } from "react";
import { Session } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { supabase } from "./lib/supabase";
import { fetchWorkspaceData } from "./lib/workspace";
import {
  documentDomainOptions,
  invitePermissionOptions,
  tenantWorkbookSections,
} from "./lib/workbookSchema";
import type {
  AppConfigRecord,
  AuthProfile,
  CommunicationRecord,
  DecisionDnaRecord,
  DocumentRecord,
  NavPage,
  TaskRecord,
  TenantProfile,
  WorkbookSection,
  WorkspaceData,
} from "./types";

type BotRole = "assistant" | "user";

interface BotMessage {
  id: string;
  role: BotRole;
  text: string;
}

interface TaskDraft {
  title: string;
  description: string;
  department: string;
  priority: string;
  assignedToId: string;
  proofRequired: boolean;
  slaDueAt: string;
}

interface InviteDraft {
  fullName: string;
  username: string;
  email: string;
  phoneNumber: string;
  role: string;
  permissions: string[];
}

interface LeasingDraft {
  candidateBrandName: string;
  category: string;
  categorySynergy: number;
  technicalFit: number;
  financialHealth: number;
  cannibalizationRisk: number;
}

interface TenantDraft {
  [key: string]: string;
}

interface ConfigDraft {
  alertThresholdP1Minutes: number;
  alertThresholdP2Minutes: number;
  alertThresholdP3Minutes: number;
  dataRefreshMinutes: number;
  autoEscalationEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  botApprovalProbeEnabled: boolean;
}

interface UploadDraft {
  file: File | null;
  notes: string;
  domainCategory: string;
  subCategory: string;
  purposeSummary: string;
}

interface ProfileDraft {
  fullName: string;
  username: string;
  phoneNumber: string;
  email: string;
  timezone: string;
  status: string;
  theme: string;
  ptoFrom: string;
  ptoTo: string;
  newPassword: string;
  confirmPassword: string;
}

interface BotToast {
  id: string;
  text: string;
}

interface ManagedUserDraft {
  userId: string;
  email: string;
  fullName: string;
  username: string;
  phoneNumber: string;
  role: string;
  permissions: string[];
}

interface TenantDetailState {
  open: boolean;
  tenantId: string | null;
}

const navItems: NavPage[] = [
  "Overview",
  "Profile",
  "Tenants",
  "Tasks",
  "Communications",
  "Document Vault",
  "Leasing Intel",
  "Approvals",
  "Invite User",
  "Configs",
];

const pageDescriptions: Record<NavPage, string> = {
  Overview: "Persona-relevant command center across operations, tenants, tasks, approvals, and decision support.",
  Profile: "Your account settings, password controls, email change flow, and workspace preferences.",
  Tenants: "Tenant master and onboarding flow powered by the same structure as your mall-level workbook.",
  Revenue: "Revenue has been merged into tenant and persona views.",
  Tasks: "Create, assign, and track operational work with SLA dates and optional proof of completion.",
  Communications: "Monitor bot-triggered internal and external outreach with lifecycle status tracking.",
  "Document Vault": "Upload onboarding files and operating documents, classify them, and stage them for approval.",
  "Leasing Intel": "Decision DNA scoring for new brands across synergy, fit, financial strength, and cannibalization.",
  Approvals: "Super admin review queue for admitting approved documents into core memory and handling conflicts.",
  "Invite User": "Invite-only access with explicit permissions, temp passwords, and first-login password reset.",
  Configs: "Thresholds, refresh behavior, channel toggles, and bot intervention settings.",
};

const initialBotMessages: BotMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text:
      "I’m ready to answer from live data, stage onboarding documents, create tasks, and call out missing onboarding fields whenever your data is incomplete.",
  },
];

const defaultTaskDraft: TaskDraft = {
  title: "",
  description: "",
  department: "facilities",
  priority: "P2",
  assignedToId: "",
  proofRequired: false,
  slaDueAt: "",
};

const defaultInviteDraft: InviteDraft = {
  fullName: "",
  username: "",
  email: "",
  phoneNumber: "",
  role: "mall_manager",
  permissions: ["view_dashboard", "view_revenue", "view_documents"],
};

const defaultLeasingDraft: LeasingDraft = {
  candidateBrandName: "",
  category: "",
  categorySynergy: 75,
  technicalFit: 75,
  financialHealth: 75,
  cannibalizationRisk: 25,
};

const defaultUploadDraft: UploadDraft = {
  file: null,
  notes: "",
  domainCategory: "leasing",
  subCategory: "tenant-onboarding",
  purposeSummary: "",
};

const defaultProfileDraft: ProfileDraft = {
  fullName: "",
  username: "",
  phoneNumber: "",
  email: "",
  timezone: "Asia/Kolkata",
  status: "available",
  theme: "dualtone",
  ptoFrom: "",
  ptoTo: "",
  newPassword: "",
  confirmPassword: "",
};

const defaultManagedUserDraft: ManagedUserDraft = {
  userId: "",
  email: "",
  fullName: "",
  username: "",
  phoneNumber: "",
  role: "mall_manager",
  permissions: [],
};

const pagePermissions: Partial<Record<NavPage, string[]>> = {
  Overview: ["view_dashboard"],
  Tasks: ["create_tasks", "assign_tasks"],
  Communications: ["send_communications"],
  "Document Vault": ["view_documents", "approve_documents"],
  "Leasing Intel": ["view_leasing_intel"],
  Approvals: ["approve_documents"],
  "Invite User": ["invite_users"],
  Configs: ["manage_configs"],
};

function formatCurrency(value: number | null) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function formatCompactCurrency(value: number | null) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value ?? 0);
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
    year: "numeric",
  });
}

function toTitle(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function canAccessPage(page: NavPage, profile: AuthProfile | null) {
  if (page === "Profile") {
    return true;
  }

  if (!profile) {
    return false;
  }

  if (profile.role === "super_admin") {
    return true;
  }

  if (page === "Tenants") {
    return ["mall_manager", "leasing_manager"].includes(profile.role) || profile.permissions.includes("view_documents");
  }

  const requiredPermissions = pagePermissions[page];
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  return requiredPermissions.some((permission) => profile.permissions.includes(permission));
}

function humanizeErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("foreign key") || normalized.includes("constraint")) {
    return "One of the linked records is missing or invalid. Please re-check the assignee and required task fields.";
  }

  if (normalized.includes("permission") || normalized.includes("unauthorized")) {
    return "You do not have permission to complete this action.";
  }

  if (normalized.includes("invalid input syntax")) {
    return "One of the values entered is not in the expected format.";
  }

  if (normalized.includes("pto")) {
    return message;
  }

  if (normalized.includes("could not be found")) {
    return message;
  }

  return message;
}

function getTenantFieldOptions(fieldKey: string) {
  const options: Record<string, string[]> = {
    Category_Primary: ["Fashion", "F&B", "Electronics", "Footwear", "Beauty", "Entertainment", "Others", "Vacant"],
    Category_Secondary: ["Casual Dining", "Quick Service", "Ethnic Wear", "Eyewear", "Footwear & Fitness", "Luxury", "Kids", "Vacant"],
    Brand_Grade: ["A", "B", "C"],
    Store_Format: ["Flagship", "Boutique", "Kiosk", "SIS", "Inline"],
    Target_Audience: ["Family", "Gen Z", "Mass Premium", "Luxury", "Kids"],
    Gas_Connection_YN: ["Yes", "No"],
    Water_Inlet_YN: ["Yes", "No"],
    Exhaust_Provision_YN: ["Yes", "No"],
    Signage_Type: ["Facade", "Digital", "Glow-sign", "Pillar"],
  };

  return options[fieldKey] ?? [];
}

function getDerivedMetric(
  label: string,
  value: string,
  note: string,
) {
  return { label, value, note };
}

function getCommunicationBadge(status: string) {
  const normalized = status.toLowerCase();

  if (["actioned", "resolved", "completed"].includes(normalized)) {
    return "good";
  }

  if (["failed", "bounced"].includes(normalized)) {
    return "bad";
  }

  if (["opened", "read", "clicked", "escalated"].includes(normalized)) {
    return "warn";
  }

  return "neutral";
}

function getDocumentBadge(status: string) {
  const normalized = status.toLowerCase();

  if (["approved"].includes(normalized)) {
    return "good";
  }

  if (["pending_approval", "pending_parse", "requires_edit"].includes(normalized)) {
    return "warn";
  }

  return "neutral";
}

function buildTenantDraft() {
  return tenantWorkbookSections.reduce<TenantDraft>((draft, section) => {
    section.fields.forEach((field) => {
      draft[field.key] = "";
    });
    return draft;
  }, {});
}

function getConfigDraft(config: AppConfigRecord | null): ConfigDraft {
  return {
    alertThresholdP1Minutes: config?.alertThresholdP1Minutes ?? 30,
    alertThresholdP2Minutes: config?.alertThresholdP2Minutes ?? 120,
    alertThresholdP3Minutes: config?.alertThresholdP3Minutes ?? 480,
    dataRefreshMinutes: config?.dataRefreshMinutes ?? 30,
    autoEscalationEnabled: config?.autoEscalationEnabled ?? true,
    emailEnabled: config?.emailEnabled ?? true,
    whatsappEnabled: config?.whatsappEnabled ?? false,
    botApprovalProbeEnabled: config?.botApprovalProbeEnabled ?? true,
  };
}

async function uploadToVault(file: File) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const storagePath = `vault/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("vault").upload(storagePath, file, {
    upsert: true,
  });

  if (error) {
    throw error;
  }

  return storagePath;
}

async function parseOnboardingWorkbook(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const organizationSheet = workbook.Sheets["Organization Breakdown"];
  const tenantSheet = workbook.Sheets["Mall level Breakdown"];

  const organizationRows = organizationSheet
    ? (XLSX.utils.sheet_to_json(organizationSheet, {
        header: 1,
        raw: false,
        defval: "",
      }) as string[][])
    : [];

  const tenantRows = tenantSheet
    ? (XLSX.utils.sheet_to_json(tenantSheet, {
        header: 1,
        raw: false,
        defval: "",
      }) as string[][])
    : [];

  const organizationKeys = organizationRows[1] ?? [];
  const organizationValues = organizationRows[3] ?? [];
  const organizationPayload = Object.fromEntries(
    organizationKeys
      .map((key, index) => [key, organizationValues[index] ?? ""])
      .filter(([key]) => Boolean(key)),
  );

  const tenantKeys = tenantRows[1] ?? [];
  const tenantPayloads = (tenantRows.slice(3) ?? [])
    .map((row) =>
      Object.fromEntries(
        tenantKeys.map((key, index) => [key, row[index] ?? ""]).filter(([key]) => Boolean(key)),
      ),
    )
    .filter((row) => String(row.Brand_Name || "").trim() !== "");

  if (organizationSheet || tenantSheet) {
    return {
      workbookType: "onboarding",
      organizationPayload,
      tenantPayloads,
      sheetNames: workbook.SheetNames,
    };
  }

  const summarySheet = workbook.Sheets["Summary"];
  const rentRollSheet = workbook.Sheets["Rent Roll"];
  const brandStatsSheet = workbook.Sheets["Sheet3"];

  const summaryRows = summarySheet
    ? (XLSX.utils.sheet_to_json(summarySheet, {
        header: 1,
        raw: false,
        defval: "",
      }) as string[][])
    : [];

  const financeSummaryRows = summaryRows
    .slice(1)
    .filter((row) => String(row[0] || "").trim())
    .map((row) => ({
      label: String(row[0] || "").trim(),
      apr: String(row[1] || "").trim(),
      may: String(row[2] || "").trim(),
      jun: String(row[3] || "").trim(),
      jul: String(row[4] || "").trim(),
      aug: String(row[5] || "").trim(),
      sep: String(row[6] || "").trim(),
      oct: String(row[7] || "").trim(),
      nov: String(row[8] || "").trim(),
      dec: String(row[9] || "").trim(),
      jan: String(row[10] || "").trim(),
      feb: String(row[11] || "").trim(),
      mar: String(row[12] || "").trim(),
      total: String(row[13] || "").trim(),
      average: String(row[14] || "").trim(),
      note: String(row[15] || "").trim(),
    }));

  const rentRollRows = rentRollSheet
    ? (() => {
        const rows = XLSX.utils.sheet_to_json(rentRollSheet, { header: 1, raw: false, defval: "" }) as string[][];
        const headerIndex = rows.findIndex((row) => row.includes("Brand Name") && row.includes("Unit No"));
        if (headerIndex === -1) {
          return [];
        }

        const headers = rows[headerIndex];
        return rows
          .slice(headerIndex + 1)
          .map((row) =>
            Object.fromEntries(
              headers
                .map((header, index) => [String(header || "").trim(), row[index] ?? ""])
                .filter(([header]) => Boolean(header)),
            ),
          )
          .filter((row) => String(row["Brand Name"] || "").trim() !== "");
      })()
    : [];

  const brandStatsRows = brandStatsSheet
    ? (() => {
        const rows = XLSX.utils.sheet_to_json(brandStatsSheet, { header: 1, raw: false, defval: "" }) as string[][];
        const headerIndex = rows.findIndex((row) => row.includes("Brand Name") && row.includes("Health Ratio"));
        if (headerIndex === -1) {
          return [];
        }

        const headers = rows[headerIndex];
        return rows
          .slice(headerIndex + 1)
          .map((row) =>
            Object.fromEntries(
              headers
                .map((header, index) => [String(header || "").trim(), row[index] ?? ""])
                .filter(([header]) => Boolean(header)),
            ),
          )
          .filter((row) => String(row["Brand Name"] || "").trim() !== "");
      })()
    : [];

  return {
    workbookType: "finance",
    organizationPayload: {},
    tenantPayloads: [],
    financeSummaryRows,
    rentRollRows,
    brandStatsRows,
    sheetNames: workbook.SheetNames,
  };
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<NavPage>(() => {
    if (typeof window === "undefined") {
      return "Overview";
    }

    const stored = window.localStorage.getItem("vetturo_active_page");
    return (stored as NavPage) || "Overview";
  });
  const [isBotOpen, setIsBotOpen] = useState(false);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [botMessages, setBotMessages] = useState<BotMessage[]>(initialBotMessages);
  const [botInput, setBotInput] = useState("");
  const [botAttachment, setBotAttachment] = useState<File | null>(null);
  const [botToast, setBotToast] = useState<BotToast | null>(null);
  const [hasUnreadBot, setHasUnreadBot] = useState(false);
  const [loginEmail, setLoginEmail] = useState("wardograza@gmail.com");
  const [loginPassword, setLoginPassword] = useState("Akkeef.2000");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submittingLogin, setSubmittingLogin] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(defaultTaskDraft);
  const [inviteDraft, setInviteDraft] = useState<InviteDraft>(defaultInviteDraft);
  const [tenantDraft, setTenantDraft] = useState<TenantDraft>(buildTenantDraft());
  const [leasingDraft, setLeasingDraft] = useState<LeasingDraft>(defaultLeasingDraft);
  const [configDraft, setConfigDraft] = useState<ConfigDraft>(getConfigDraft(null));
  const [uploadDraft, setUploadDraft] = useState<UploadDraft>(defaultUploadDraft);
  const [savingState, setSavingState] = useState<string | null>(null);
  const [tenantSearch, setTenantSearch] = useState("");
  const [revenueSearch, setRevenueSearch] = useState("");
  const [showInvitePermissions, setShowInvitePermissions] = useState(false);
  const [mustResetPassword, setMustResetPassword] = useState(false);
  const [showFirstResetPassword, setShowFirstResetPassword] = useState(false);
  const [showFirstResetConfirm, setShowFirstResetConfirm] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(defaultProfileDraft);
  const [showProfilePassword, setShowProfilePassword] = useState(false);
  const [showProfileConfirmPassword, setShowProfileConfirmPassword] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<DocumentRecord | null>(null);
  const [pendingConflicts, setPendingConflicts] = useState<string[]>([]);
  const [inviteBanner, setInviteBanner] = useState<string | null>(null);
  const [tenantPageSize, setTenantPageSize] = useState(25);
  const [tenantPage, setTenantPage] = useState(1);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [tenantDetailState, setTenantDetailState] = useState<TenantDetailState>({ open: false, tenantId: null });
  const [managedUserDraft, setManagedUserDraft] = useState<ManagedUserDraft>(defaultManagedUserDraft);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function loadWorkspace() {
    setWorkspaceLoading(true);
    setWorkspaceError(null);

    try {
      const data = await fetchWorkspaceData(session?.access_token);
      setWorkspace(data);
      setConfigDraft(getConfigDraft(data.config));

      const signedInProfile = session?.user?.email
        ? data.profiles.find((profile) => profile.email === session.user.email) || null
        : null;
      setMustResetPassword(Boolean(signedInProfile?.mustResetPassword));

      setProfileDraft((current) => ({
        ...current,
        fullName: signedInProfile?.fullName ?? "",
        username: signedInProfile?.username ?? "",
        phoneNumber: signedInProfile?.phoneNumber ?? "",
        email: session?.user?.email ?? "",
        timezone:
          signedInProfile?.timezone ??
          (typeof session?.user?.user_metadata?.timezone === "string" ? session.user.user_metadata.timezone : current.timezone),
        status:
          signedInProfile?.availabilityStatus ??
          (typeof session?.user?.user_metadata?.status === "string" ? session.user.user_metadata.status : current.status),
        theme:
          signedInProfile?.themePreference ??
          (typeof session?.user?.user_metadata?.theme === "string" ? session.user.user_metadata.theme : current.theme),
        ptoFrom:
          signedInProfile?.ptoFrom ??
          (typeof session?.user?.user_metadata?.ptoFrom === "string" ? session.user.user_metadata.ptoFrom : current.ptoFrom),
        ptoTo:
          signedInProfile?.ptoTo ??
          (typeof session?.user?.user_metadata?.ptoTo === "string" ? session.user.user_metadata.ptoTo : current.ptoTo),
      }));
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to load workspace.");
    } finally {
      setWorkspaceLoading(false);
    }
  }

  useEffect(() => {
    if (!session) {
      setWorkspace(null);
      return;
    }

    void loadWorkspace();
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const refreshMinutes = configDraft.dataRefreshMinutes || 30;
    const interval = window.setInterval(() => {
      void loadWorkspace();
    }, Math.max(refreshMinutes, 15) * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [session, configDraft.dataRefreshMinutes]);

  useEffect(() => {
    document.documentElement.dataset.theme = profileDraft.theme === "dark" ? "dark" : "light";
  }, [profileDraft.theme]);

  const currentProfile = useMemo<AuthProfile | null>(() => {
    if (!workspace || !session?.user?.email) {
      return null;
    }

    return workspace.profiles.find((profile) => profile.email === session.user?.email) || null;
  }, [workspace, session]);

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => canAccessPage(item, currentProfile)),
    [currentProfile],
  );

  useEffect(() => {
    if (workspaceLoading || !workspace) {
      return;
    }

    if (!visibleNavItems.includes(activePage)) {
      setActivePage(visibleNavItems[0] ?? "Overview");
    }
  }, [activePage, visibleNavItems, workspace, workspaceLoading]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("vetturo_active_page", activePage);
    }
  }, [activePage]);

  const tenants = workspace?.tenants ?? [];
  const tasks = workspace?.tasks ?? [];
  const documents = workspace?.documents ?? [];
  const pendingDocuments = documents.filter((document) => document.status !== "approved");
  const communications = workspace?.communications ?? [];
  const leasingIntel = workspace?.decisionDna ?? [];
  const invites = workspace?.invites ?? [];
  const onboardingGaps = workspace?.onboardingGaps ?? [];

  const tenantResults = useMemo(() => {
    const query = tenantSearch.trim().toLowerCase();
    if (!query) {
      return tenants;
    }

    return tenants.filter((tenant) =>
      [tenant.brandName, tenant.unitCode, tenant.categoryPrimary, tenant.parentCompany]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [tenantSearch, tenants]);

  const revenueResults = useMemo(() => {
    const query = revenueSearch.trim().toLowerCase();
    if (!query) {
      return tenants;
    }

    return tenants.filter((tenant) =>
      [tenant.brandName, tenant.categoryPrimary, tenant.unitCode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [revenueSearch, tenants]);

  const revenueSummary = useMemo(() => {
    const total = tenants.reduce((sum, tenant) => sum + tenant.rent, 0);
    const topFive = [...tenants].sort((left, right) => right.rent - left.rent).slice(0, 5);
    const topFiveTotal = topFive.reduce((sum, tenant) => sum + tenant.rent, 0);

    return {
      total,
      average: tenants.length > 0 ? total / tenants.length : 0,
      topFiveShare: total > 0 ? Math.round((topFiveTotal / total) * 100) : 0,
      topFive,
    };
  }, [tenants]);

  const overviewMetrics = useMemo(() => {
    const expiringLeases = tenants.filter((tenant) => {
      if (!tenant.leaseExpiryDate) return false;
      const expiry = new Date(tenant.leaseExpiryDate).getTime();
      const now = Date.now();
      const ninetyDays = 1000 * 60 * 60 * 24 * 90;
      return Number.isFinite(expiry) && expiry >= now && expiry <= now + ninetyDays;
    }).length;

    const missingLeaseExpiry = tenants.filter((tenant) => !tenant.leaseExpiryDate).length;
    const auditCoverage = tenants.filter((tenant) => typeof tenant.lastAuditScore === "number").length;
    const facilitiesTasks = tasks.filter((task) => (task.department || "").toLowerCase() === "facilities").length;
    const financeRelevant = communications.filter((item) => (item.purpose || "").toLowerCase().includes("recovery")).length;

    switch (currentProfile?.role) {
      case "finance":
        return [
          getDerivedMetric("Tracked Rent Base", formatCompactCurrency(revenueSummary.total), "Live rent mapped from approved tenant and finance records"),
          getDerivedMetric("Average Rent", formatCompactCurrency(revenueSummary.average), "Average across currently stored tenant records"),
          getDerivedMetric(
            "Recovery Threads",
            String(financeRelevant),
            financeRelevant > 0 ? "Finance-related outreach is active" : "Need communication or recovery data to calculate this",
          ),
          getDerivedMetric(
            "Missing Lease Expiry",
            String(missingLeaseExpiry),
            missingLeaseExpiry > 0 ? "Add lease expiry dates to improve renewal and escalation finance logic" : "Lease expiry coverage is available",
          ),
        ];
      case "leasing_manager":
        return [
          getDerivedMetric("Tenant Count", String(tenants.length), "Brands currently stored in the tenant master"),
          getDerivedMetric(
            "Expiring Leases (90d)",
            String(expiringLeases),
            missingLeaseExpiry > 0 ? `Need ${missingLeaseExpiry} more lease expiry values for a complete count` : "Based on current lease expiry dates",
          ),
          getDerivedMetric("Decision DNA Entries", String(leasingIntel.length), leasingIntel.length > 0 ? "Live leasing evaluations stored" : "Need brand-vetting inputs to calculate this"),
          getDerivedMetric("Pending Approvals", String(pendingDocuments.length), "Documents waiting to be admitted into memory"),
        ];
      case "facilities":
        return [
          getDerivedMetric("Open Tasks", String(tasks.length), "Current operational queue"),
          getDerivedMetric("Facilities Tasks", String(facilitiesTasks), facilitiesTasks > 0 ? "Tasks routed to facilities" : "Need facilities tasks to calculate this"),
          getDerivedMetric("Proof Required", String(tasks.filter((task) => task.proofRequired).length), "Tasks expecting evidence on closure"),
          getDerivedMetric("Audit Coverage", `${auditCoverage}/${tenants.length}`, auditCoverage > 0 ? "Brand audit data currently stored" : "Need brand audit or compliance scores to calculate this"),
        ];
      case "mall_manager":
        return [
          getDerivedMetric("Tenant Count", String(tenants.length), "Brands currently live in the workspace"),
          getDerivedMetric("Open Tasks", String(tasks.length), "Operational items across departments"),
          getDerivedMetric("Pending Approvals", String(pendingDocuments.length), "Documents waiting on super admin action"),
          getDerivedMetric("Tracked Communications", String(communications.length), communications.length > 0 ? "Communication threads are active" : "Need outgoing communication records to calculate this"),
        ];
      default:
        return [
          getDerivedMetric("Tenant Count", String(tenants.length), "Brands currently stored"),
          getDerivedMetric("Tracked Rent Base", formatCompactCurrency(revenueSummary.total), "Live rent mapped from tenant records"),
          getDerivedMetric("Pending Approvals", String(pendingDocuments.length), "Documents waiting to enter core memory"),
          getDerivedMetric("Open Tasks", String(tasks.length), "Operational queue across teams"),
        ];
    }
  }, [communications.length, currentProfile?.role, leasingIntel.length, pendingDocuments.length, revenueSummary.average, revenueSummary.total, tasks, tenants]);

  const paginatedTenantResults = useMemo(() => {
    const start = (tenantPage - 1) * tenantPageSize;
    return tenantResults.slice(start, start + tenantPageSize);
  }, [tenantPage, tenantPageSize, tenantResults]);

  const selectedTenant = useMemo(
    () => tenantResults.find((tenant) => tenant.id === selectedTenantId) ?? tenantResults[0] ?? null,
    [selectedTenantId, tenantResults],
  );

  const detailTenant = useMemo(
    () => tenantResults.find((tenant) => tenant.id === tenantDetailState.tenantId) ?? null,
    [tenantDetailState.tenantId, tenantResults],
  );

  useEffect(() => {
    setTenantPage(1);
  }, [tenantSearch, tenantPageSize]);

  useEffect(() => {
    if (!selectedTenantId && tenantResults[0]) {
      setSelectedTenantId(tenantResults[0].id);
      return;
    }

    if (selectedTenantId && !tenantResults.some((tenant) => tenant.id === selectedTenantId)) {
      setSelectedTenantId(tenantResults[0]?.id ?? null);
    }
  }, [selectedTenantId, tenantResults]);

  async function callApi<T>(path: string, body: object) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const response = await fetch(path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const json = (await response.json()) as T & { error?: string };

    if (!response.ok) {
      throw new Error(json.error || `Request failed: ${path}`);
    }

    return json;
  }

  function pushBot(role: BotRole, text: string) {
    const id = `${role}-${Date.now()}-${Math.random()}`;
    setBotMessages((messages) => [...messages, { id, role, text }]);

    if (role === "assistant" && !isBotOpen) {
      setBotToast({ id, text });
      window.setTimeout(() => {
        setBotToast((current) => (current?.id === id ? null : current));
      }, 5000);

      setHasUnreadBot(true);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setLoginError("Supabase is not configured.");
      return;
    }

    setSubmittingLogin(true);
    setLoginError(null);

    let loginEmailAddress = loginEmail.trim();

    if (!loginEmailAddress.includes("@")) {
      const lookupResponse = await fetch("/api/profile-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "lookup_username",
          username: loginEmailAddress,
        }),
      });

      const lookupJson = (await lookupResponse.json()) as { email?: string; error?: string };

      if (!lookupResponse.ok || !lookupJson.email) {
        setLoginError(lookupJson.error || "That username could not be found.");
        setSubmittingLogin(false);
        return;
      }

      loginEmailAddress = lookupJson.email;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmailAddress,
      password: loginPassword,
    });

    if (error) {
      setLoginError(error.message);
    }

    setSubmittingLogin(false);
  }

  async function handleLogout() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setBotMessages(initialBotMessages);
    setActivePage("Overview");
    window.localStorage.removeItem("vetturo_active_page");
  }

  async function handlePasswordReset() {
    if (!supabase || !profileDraft.newPassword.trim()) {
      setWorkspaceError("Enter a new password.");
      return;
    }

    if (profileDraft.newPassword !== profileDraft.confirmPassword) {
      setWorkspaceError("Password confirmation does not match.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: profileDraft.newPassword.trim() });

    if (error) {
      setWorkspaceError(error.message);
      return;
    }

    await callApi("/api/profile-update", { mustResetPassword: false });
    setMustResetPassword(false);
    setProfileDraft((draft) => ({ ...draft, newPassword: "", confirmPassword: "" }));
    pushBot("assistant", "Your permanent password has been set. You can continue using the workspace.");
    await loadWorkspace();
  }

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      return;
    }

    setSavingState("profile");

    try {
      await callApi("/api/profile-update", {
        fullName: profileDraft.fullName,
        username: profileDraft.username,
        phoneNumber: profileDraft.phoneNumber,
        timezone: profileDraft.timezone,
        status: profileDraft.status,
        theme: profileDraft.theme,
        ptoFrom: profileDraft.ptoFrom,
        ptoTo: profileDraft.ptoTo,
      });

      const metadataPayload = {
        timezone: profileDraft.timezone,
        status: profileDraft.status,
        theme: profileDraft.theme,
        ptoFrom: profileDraft.ptoFrom,
        ptoTo: profileDraft.ptoTo,
      };

      const updates = [];
      updates.push(supabase.auth.updateUser({ data: metadataPayload }));

      if (profileDraft.email.trim() && profileDraft.email.trim() !== session?.user?.email) {
        updates.push(supabase.auth.updateUser({ email: profileDraft.email.trim() }));
      }

      if (profileDraft.newPassword.trim()) {
        if (profileDraft.newPassword !== profileDraft.confirmPassword) {
          throw new Error("Password confirmation does not match.");
        }

        updates.push(supabase.auth.updateUser({ password: profileDraft.newPassword.trim() }));
        updates.push(callApi("/api/profile-update", { mustResetPassword: false }));
      }

      const results = await Promise.all(updates);
      const authError = results.find(
        (result) => typeof result === "object" && result !== null && "error" in result && result.error,
      );

      if (authError && typeof authError === "object" && authError !== null && "error" in authError && authError.error) {
        throw authError.error;
      }

      setMustResetPassword(false);
      setProfileDraft((draft) => ({ ...draft, newPassword: "", confirmPassword: "" }));
      pushBot(
        "assistant",
        profileDraft.email.trim() !== session?.user?.email
          ? "Profile updated. Supabase will require email re-verification for the new address."
          : "Profile and account settings updated.",
      );
      await loadWorkspace();
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Profile update failed.");
    } finally {
      setSavingState(null);
    }
  }

  async function handleBotSubmit(event?: { preventDefault?: () => void }) {
    event?.preventDefault?.();

    const message = botInput.trim();
    if (!message && !botAttachment) {
      return;
    }

    pushBot("user", botAttachment ? `${message || "Uploaded a file"} (${botAttachment.name})` : message);
    setBotInput("");

    try {
      if (botAttachment) {
        const result = await callApi<{
          domain: string;
          subCategory: string;
          purposeSummary: string;
          followUpQuestion: string;
        }>("/api/copilot", {
          mode: "classify_document",
          fileName: botAttachment.name,
          notes: message,
          existingSelection: null,
        });

        const storagePath = await uploadToVault(botAttachment);
        await callApi("/api/document-register", {
          fileName: botAttachment.name,
          storagePath,
          documentType: /\.xlsx$/i.test(botAttachment.name) ? "onboarding" : "general",
          domainCategory: result.domain,
          subCategory: result.subCategory,
          purposeSummary: result.purposeSummary,
          parserSummary: message || `Uploaded via copilot chat.`,
          sourcePayload: /\.xlsx$/i.test(botAttachment.name) ? await parseOnboardingWorkbook(botAttachment) : null,
        });

        setBotAttachment(null);
        pushBot(
          "assistant",
          result.followUpQuestion ||
            `I staged ${botAttachment.name} in the vault under ${result.domain}/${result.subCategory}. It now needs approval before entering core memory.`,
        );
        await loadWorkspace();
        return;
      }

      const result = await callApi<{ reply: string; action?: { page?: NavPage } }>("/api/copilot", {
        message,
      });

      if (result.action?.page) {
        setActivePage(result.action.page);
      }

      pushBot("assistant", result.reply);
    } catch (error) {
      pushBot("assistant", error instanceof Error ? error.message : "The copilot could not complete that request.");
    }
  }

  async function handleTaskCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingState("task");

    try {
      const result = await callApi<{ message?: string }>("/api/tasks", taskDraft);
      setTaskDraft(defaultTaskDraft);
      pushBot("assistant", result.message || "Task created and routed into the operational queue.");
      await loadWorkspace();
    } catch (error) {
      setWorkspaceError(
        error instanceof Error
          ? `Task creation failed. ${humanizeErrorMessage(error.message)}`
          : "Task creation failed. Please check the entered details.",
      );
    } finally {
      setSavingState(null);
    }
  }

  async function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingState("invite");

    try {
      const result = await callApi<{ ok: boolean; warning?: string; tempPassword?: string }>(
        "/api/invite-user",
        inviteDraft,
      );
      setInviteDraft(defaultInviteDraft);
      setShowInvitePermissions(false);
      pushBot(
        "assistant",
        result.warning
          ? `User was created, but email delivery was blocked. Temporary password: ${result.tempPassword}. Reason: ${result.warning}`
          : "User invite submitted. The temp-password email has been sent.",
      );
      if (result.tempPassword) {
        setInviteBanner(`Temporary password for ${inviteDraft.email}: ${result.tempPassword}`);
      }
      await loadWorkspace();
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Invite flow failed.");
    } finally {
      setSavingState(null);
    }
  }

  async function handleTenantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingState("tenant");

    try {
      await callApi("/api/tenant-upsert", { payload: tenantDraft });
      setTenantDraft(buildTenantDraft());
      pushBot("assistant", "Tenant onboarding data has been added to the live tenant master.");
      await loadWorkspace();
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Tenant onboarding failed.");
    } finally {
      setSavingState(null);
    }
  }

  async function handleLeasingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingState("leasing");

    try {
      await callApi("/api/leasing-intel", leasingDraft);
      setLeasingDraft(defaultLeasingDraft);
      pushBot("assistant", "Decision DNA entry saved.");
      await loadWorkspace();
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Leasing intel save failed.");
    } finally {
      setSavingState(null);
    }
  }

  async function handleUploadClassify() {
    if (!uploadDraft.file) {
      return;
    }

    setSavingState("classify");

    try {
      const result = await callApi<{
        domain: string;
        subCategory: string;
        purposeSummary: string;
        followUpQuestion: string;
      }>("/api/copilot", {
        mode: "classify_document",
        fileName: uploadDraft.file.name,
        notes: uploadDraft.notes,
        existingSelection: {
          domainCategory: uploadDraft.domainCategory,
          subCategory: uploadDraft.subCategory,
        },
      });

      setUploadDraft((draft) => ({
        ...draft,
        domainCategory: result.domain || draft.domainCategory,
        subCategory: result.subCategory || draft.subCategory,
        purposeSummary: result.purposeSummary || draft.purposeSummary,
      }));

      pushBot(
        "assistant",
        result.followUpQuestion ||
          `I’d store this under ${result.domain}/${result.subCategory}. Confirm or refine the purpose before approval.`,
      );
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Document classification failed.");
    } finally {
      setSavingState(null);
    }
  }

  async function handleDocumentUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!uploadDraft.file || !session) {
      return;
    }

    setSavingState("document");

    try {
      const storagePath = await uploadToVault(uploadDraft.file);
      const isWorkbook = /\.xlsx$/i.test(uploadDraft.file.name);
      const parsedPayload = isWorkbook ? await parseOnboardingWorkbook(uploadDraft.file) : null;

      await callApi("/api/document-register", {
        fileName: uploadDraft.file.name,
        storagePath,
        documentType: isWorkbook ? "onboarding" : "general",
        domainCategory: uploadDraft.domainCategory,
        subCategory: uploadDraft.subCategory,
        purposeSummary: uploadDraft.purposeSummary,
        parserSummary: isWorkbook
          ? `Workbook parsed with ${parsedPayload?.tenantPayloads?.length ?? 0} tenant row(s).`
          : uploadDraft.notes,
        sourcePayload: parsedPayload,
      });

      pushBot(
        "assistant",
        "Document uploaded. Before it enters core memory, I’ll wait for a super admin approval and any overwrite confirmation if conflicts are found.",
      );

      setUploadDraft(defaultUploadDraft);
      await loadWorkspace();
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Document upload failed.");
    } finally {
      setSavingState(null);
    }
  }

  async function handleApprove(documentId: string, allowOverwrite = false) {
    setSavingState("approve");

    try {
      const result = await callApi<{ ok?: boolean; requiresConfirmation?: boolean; conflicts?: [string, unknown][] }>(
        "/api/documents-approve",
        { documentId, allowOverwrite },
      );

      if (result.requiresConfirmation) {
        setPendingApproval(documents.find((document) => document.id === documentId) ?? null);
        setPendingConflicts((result.conflicts ?? []).map(([key]) => key));
        pushBot(
          "assistant",
          "I found existing values that this approval would overwrite. Review the conflict list and approve again if you want the new data to replace the old data.",
        );
      } else {
        setPendingApproval(null);
        setPendingConflicts([]);
        pushBot("assistant", "Document approved and moved into core memory.");
        await loadWorkspace();
      }
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Approval failed.");
    } finally {
      setSavingState(null);
    }
  }

  async function handleUserAdmin(action: "reset_password" | "delete_user" | "update_user") {
    if (!managedUserDraft.userId) {
      setWorkspaceError("Select a user first.");
      return;
    }

    setSavingState("user-admin");

    try {
      const result = await callApi<{ ok: boolean; tempPassword?: string }>("/api/user-admin", {
        action,
        ...managedUserDraft,
      });

      if (action === "reset_password" && result.tempPassword) {
        setInviteBanner(`Temporary password for ${managedUserDraft.email}: ${result.tempPassword}`);
        pushBot("assistant", `Password reset completed for ${managedUserDraft.fullName || managedUserDraft.email}.`);
      }

      if (action === "delete_user") {
        pushBot("assistant", `${managedUserDraft.fullName || managedUserDraft.email} has been removed.`);
        setManagedUserDraft(defaultManagedUserDraft);
      }

      if (action === "update_user") {
        pushBot("assistant", `${managedUserDraft.fullName || managedUserDraft.email} has been updated.`);
      }

      await loadWorkspace();
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "User admin action failed.");
    } finally {
      setSavingState(null);
    }
  }

  async function handleConfigSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingState("config");

    try {
      await callApi("/api/configs", configDraft);
      pushBot("assistant", "Config thresholds and refresh settings have been updated.");
      await loadWorkspace();
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Config save failed.");
    } finally {
      setSavingState(null);
    }
  }

  if (authLoading) {
    return <div className="screen-message">Loading authentication…</div>;
  }

  if (!session) {
    return (
      <div className="login-shell">
        <section className="login-card">
          <p className="section-kicker">Vetturo OS</p>
          <h1>Sign in</h1>
          <p className="page-copy">Invite-only access. Public signup is disabled.</p>

          <form className="form-stack" onSubmit={handleLogin}>
            <label className="field">
              <span>Username</span>
              <input value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} type="text" />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                type={showLoginPassword ? "text" : "password"}
              />
            </label>
            <label className="checkbox-field compact-check">
              <input checked={showLoginPassword} onChange={(event) => setShowLoginPassword(event.target.checked)} type="checkbox" />
              <span>Show password</span>
            </label>
            {loginError ? <p className="error-copy">{loginError}</p> : null}
            <button className="primary-button full-width" disabled={submittingLogin} type="submit">
              {submittingLogin ? "Signing in…" : "Login"}
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className={`workspace-shell ${isNavCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-row">
            {!isNavCollapsed ? (
              <div>
                <p className="sidebar-kicker">Vetturo OS</p>
              </div>
            ) : (
              <strong className="mini-brand">V</strong>
            )}
            <button className="icon-button" onClick={() => setIsNavCollapsed((current) => !current)} type="button">
              {isNavCollapsed ? "☰" : "☰"}
            </button>
          </div>
          {!isNavCollapsed ? (
            <>
              <p className="sidebar-copy">
                {currentProfile
                  ? `${currentProfile.fullName} • ${toTitle(currentProfile.role)}`
                  : "Secure mall operations workspace"}
              </p>
              <p className="sidebar-status">
                {toTitle(profileDraft.status)}
                {profileDraft.status === "PTO" && profileDraft.ptoFrom && profileDraft.ptoTo
                  ? ` • ${formatDate(profileDraft.ptoFrom)} to ${formatDate(profileDraft.ptoTo)}`
                  : ""}
              </p>
            </>
          ) : null}
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {visibleNavItems.filter((item) => item !== "Profile").map((item) => (
            <button
              className={`nav-button ${item === activePage ? "active" : ""}`}
              key={item}
              onClick={() => setActivePage(item)}
              type="button"
            >
              {isNavCollapsed ? item.charAt(0) : item}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer-row">
          {visibleNavItems.includes("Profile") ? (
            <button
              className={`nav-button footer-nav-button ${activePage === "Profile" ? "active" : ""}`}
              onClick={() => setActivePage("Profile")}
              type="button"
            >
              {isNavCollapsed ? "P" : "Profile"}
            </button>
          ) : null}

          <button className="secondary-button footer-nav-button" onClick={handleLogout} type="button">
            {isNavCollapsed ? "Out" : "Logout"}
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="page-header compact">
          <div>
            <p className="page-kicker">{activePage}</p>
            <h2>{activePage}</h2>
            <p className="page-copy">{pageDescriptions[activePage]}</p>
          </div>
        </header>

        {workspaceLoading ? <section className="state-card">Loading workspace…</section> : null}
        {workspaceError ? <section className="state-card error">{workspaceError}</section> : null}
        {inviteBanner ? (
          <section className="state-card invite-banner">
            <div>
              <strong>Temporary password ready</strong>
              <p>{inviteBanner}</p>
            </div>
            <button className="secondary-button" onClick={() => setInviteBanner(null)} type="button">
              Acknowledge
            </button>
          </section>
        ) : null}

        {!workspaceLoading && workspace ? (
          <PageRenderer
            activePage={activePage}
            communications={communications}
            configDraft={configDraft}
            documents={documents}
            inviteDraft={inviteDraft}
            invites={invites}
            leasingDraft={leasingDraft}
            leasingIntel={leasingIntel}
            managedUserDraft={managedUserDraft}
            overviewMetrics={overviewMetrics}
            pendingApproval={pendingApproval}
            pendingConflicts={pendingConflicts}
            pendingDocuments={pendingDocuments}
            profileDraft={profileDraft}
            profiles={workspace.profiles}
            selectedTenant={selectedTenant}
            revenueResults={revenueResults}
            revenueSearch={revenueSearch}
            revenueSummary={revenueSummary}
            savingState={savingState}
            setConfigDraft={setConfigDraft}
            setInviteDraft={setInviteDraft}
            setLeasingDraft={setLeasingDraft}
            setManagedUserDraft={setManagedUserDraft}
            setProfileDraft={setProfileDraft}
            setRevenueSearch={setRevenueSearch}
            setShowInvitePermissions={setShowInvitePermissions}
            setShowProfileConfirmPassword={setShowProfileConfirmPassword}
            setShowProfilePassword={setShowProfilePassword}
            setTaskDraft={setTaskDraft}
            setTenantDraft={setTenantDraft}
            setSelectedTenantId={setSelectedTenantId}
            setTenantDetailState={setTenantDetailState}
            setTenantPage={setTenantPage}
            setTenantPageSize={setTenantPageSize}
            setTenantSearch={setTenantSearch}
            setUploadDraft={setUploadDraft}
            showInvitePermissions={showInvitePermissions}
            showProfileConfirmPassword={showProfileConfirmPassword}
            showProfilePassword={showProfilePassword}
            taskDraft={taskDraft}
            tasks={tasks}
            tenantDraft={tenantDraft}
            tenantPage={tenantPage}
            tenantPageSize={tenantPageSize}
            tenantPageCount={Math.max(1, Math.ceil(tenantResults.length / tenantPageSize))}
            paginatedTenantResults={paginatedTenantResults}
            tenantSearch={tenantSearch}
            uploadDraft={uploadDraft}
            onApprove={handleApprove}
            onClassifyDocument={handleUploadClassify}
            onConfigSave={handleConfigSave}
            onInviteSubmit={handleInviteSubmit}
            onLeasingSubmit={handleLeasingSubmit}
            onProfileSave={handleProfileSave}
            onTaskCreate={handleTaskCreate}
            onTenantSubmit={handleTenantSubmit}
            onUserAdmin={handleUserAdmin}
            onUploadSubmit={handleDocumentUpload}
          />
        ) : null}
      </main>

      {isBotOpen ? (
        <aside className="bot-panel floating">
          <div className="bot-header">
            <div>
              <p className="panel-kicker">Vetturo</p>
              <h3>Copilot</h3>
            </div>
          </div>

          <div className="bot-body">
            {botMessages.map((message) => (
              <div className={`bot-message ${message.role}`} key={message.id}>
                {message.text}
              </div>
            ))}
          </div>

          <form className="bot-form" onSubmit={handleBotSubmit}>
            <textarea
              className="bot-input"
              value={botInput}
              onChange={(event) => setBotInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleBotSubmit(event);
                }
              }}
              placeholder="Ask for revenue numbers, missing onboarding data, or operational help."
              rows={4}
            />
            <label className="field">
              <span>Attach file</span>
              <input type="file" accept=".pdf,.xlsx,.xls" onChange={(event) => setBotAttachment(event.target.files?.[0] || null)} />
              <small>{botAttachment ? `Attached: ${botAttachment.name}` : "Optional: upload through the copilot."}</small>
            </label>
            <button className="primary-button full-width" type="submit">
              {botAttachment ? "Send with attachment" : "Ask Vetturo"}
            </button>
          </form>
        </aside>
      ) : null}

      {botToast ? (
        <button
          className="bot-toast"
          onClick={() => {
            setIsBotOpen(true);
            setHasUnreadBot(false);
            setBotToast(null);
          }}
          type="button"
        >
          {botToast.text.slice(0, 140)}{botToast.text.length > 140 ? "…" : ""}
        </button>
      ) : null}

      <button
        className={`bot-launcher ${hasUnreadBot ? "unread" : ""}`}
        onClick={() => {
          setIsBotOpen((current) => !current);
          setHasUnreadBot(false);
          setBotToast(null);
        }}
        type="button"
      >
        {isBotOpen ? "×" : "V"}
      </button>

      {mustResetPassword ? (
        <div className="modal-scrim">
          <section className="modal-card">
            <p className="section-kicker">First Login</p>
            <h3>Create your permanent password</h3>
            <p className="page-copy">You need to change the temporary password before entering the workspace.</p>
            <div className="form-stack">
              <label className="field">
                <span>New Password</span>
                <input
                  placeholder="Enter new password"
                  type={showFirstResetPassword ? "text" : "password"}
                  value={profileDraft.newPassword}
                  onChange={(event) => setProfileDraft((draft) => ({ ...draft, newPassword: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>Confirm Password</span>
                <input
                  placeholder="Confirm new password"
                  type={showFirstResetConfirm ? "text" : "password"}
                  value={profileDraft.confirmPassword}
                  onChange={(event) => setProfileDraft((draft) => ({ ...draft, confirmPassword: event.target.value }))}
                />
              </label>
              <label className="checkbox-field compact-check">
                <input checked={showFirstResetPassword} onChange={(event) => setShowFirstResetPassword(event.target.checked)} type="checkbox" />
                <span>Show new password</span>
              </label>
              <label className="checkbox-field compact-check">
                <input checked={showFirstResetConfirm} onChange={(event) => setShowFirstResetConfirm(event.target.checked)} type="checkbox" />
                <span>Show confirmation</span>
              </label>
              <p className={`match-copy ${profileDraft.newPassword && profileDraft.confirmPassword && profileDraft.newPassword === profileDraft.confirmPassword ? "good" : "warn"}`}>
                {profileDraft.newPassword || profileDraft.confirmPassword
                  ? profileDraft.newPassword === profileDraft.confirmPassword
                    ? "Passwords match."
                    : "Passwords do not match yet."
                  : "Enter and confirm the new password."}
              </p>
              <button className="primary-button full-width" onClick={handlePasswordReset} type="button">
                Save password
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {tenantDetailState.open && detailTenant ? (
        <div className="modal-scrim" onClick={() => setTenantDetailState({ open: false, tenantId: null })}>
          <section className="modal-card tenant-modal" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Brand Detail</p>
                <h3>{detailTenant.brandName}</h3>
              </div>
              <button className="icon-button" onClick={() => setTenantDetailState({ open: false, tenantId: null })} type="button">
                ×
              </button>
            </div>
            <div className="thread-list">
              <div className="mini-stats three-up">
                <MetricCard label="Rent" value={formatCompactCurrency(detailTenant.rent)} note="Tracked base" />
                <MetricCard label="SBA / GLA" value={detailTenant.unitGlaSba ? String(detailTenant.unitGlaSba) : "N/A"} note="Area" />
                <MetricCard label="Audit / Health" value={detailTenant.lastAuditScore ? `${detailTenant.lastAuditScore}` : "N/A"} note="Latest score" />
              </div>
              <div className="thread-card">
                <strong>Brand profile</strong>
                <p>{detailTenant.categoryPrimary || "No category"} • {detailTenant.categorySecondary || "No sub-category"} • {detailTenant.parentCompany || "No parent company"}</p>
                <small>Lease expiry {formatDate(detailTenant.leaseExpiryDate)} • Store manager {detailTenant.storeManagerName || "Not provided"}</small>
              </div>
              <div className="graph-card">
                <strong>Category comparison</strong>
                <BarMetric label="Rent vs category average" value={detailTenant.rent} max={Math.max(...tenantResults.filter((tenant) => tenant.categoryPrimary === detailTenant.categoryPrimary).map((tenant) => tenant.rent), detailTenant.rent, 1)} />
                <BarMetric label="Area footprint" value={detailTenant.unitGlaSba || 0} max={Math.max(...tenantResults.map((tenant) => tenant.unitGlaSba || 0), detailTenant.unitGlaSba || 0, 1)} />
                <BarMetric label="Audit / health ratio" value={detailTenant.lastAuditScore || 0} max={100} />
              </div>
              <div className="thread-card">
                <strong>Onboarding gaps</strong>
                <p>
                  {onboardingGaps
                    .filter((gap) => gap.recordLabel.toLowerCase() === detailTenant.brandName.toLowerCase())
                    .flatMap((gap) => gap.missingFields)
                    .join(", ") || "No required onboarding gaps detected for this brand."}
                </p>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

interface PageRendererProps {
  activePage: NavPage;
  communications: CommunicationRecord[];
  configDraft: ConfigDraft;
  documents: DocumentRecord[];
  inviteDraft: InviteDraft;
  invites: WorkspaceData["invites"];
  leasingDraft: LeasingDraft;
  leasingIntel: DecisionDnaRecord[];
  managedUserDraft: ManagedUserDraft;
  overviewMetrics: { label: string; value: string; note: string }[];
  pendingApproval: DocumentRecord | null;
  pendingConflicts: string[];
  pendingDocuments: DocumentRecord[];
  profileDraft: ProfileDraft;
  profiles: AuthProfile[];
  selectedTenant: TenantProfile | null;
  revenueResults: TenantProfile[];
  revenueSearch: string;
  revenueSummary: { total: number; average: number; topFiveShare: number; topFive: TenantProfile[] };
  savingState: string | null;
  setConfigDraft: React.Dispatch<React.SetStateAction<ConfigDraft>>;
  setInviteDraft: React.Dispatch<React.SetStateAction<InviteDraft>>;
  setLeasingDraft: React.Dispatch<React.SetStateAction<LeasingDraft>>;
  setManagedUserDraft: React.Dispatch<React.SetStateAction<ManagedUserDraft>>;
  setProfileDraft: React.Dispatch<React.SetStateAction<ProfileDraft>>;
  setRevenueSearch: React.Dispatch<React.SetStateAction<string>>;
  setShowInvitePermissions: React.Dispatch<React.SetStateAction<boolean>>;
  setShowProfileConfirmPassword: React.Dispatch<React.SetStateAction<boolean>>;
  setShowProfilePassword: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedTenantId: React.Dispatch<React.SetStateAction<string | null>>;
  setTenantDetailState: React.Dispatch<React.SetStateAction<TenantDetailState>>;
  setTaskDraft: React.Dispatch<React.SetStateAction<TaskDraft>>;
  setTenantPage: React.Dispatch<React.SetStateAction<number>>;
  setTenantPageSize: React.Dispatch<React.SetStateAction<number>>;
  setTenantDraft: React.Dispatch<React.SetStateAction<TenantDraft>>;
  setTenantSearch: React.Dispatch<React.SetStateAction<string>>;
  setUploadDraft: React.Dispatch<React.SetStateAction<UploadDraft>>;
  showInvitePermissions: boolean;
  showProfileConfirmPassword: boolean;
  showProfilePassword: boolean;
  taskDraft: TaskDraft;
  tasks: TaskRecord[];
  tenantDraft: TenantDraft;
  tenantPage: number;
  tenantPageCount: number;
  tenantPageSize: number;
  paginatedTenantResults: TenantProfile[];
  tenantSearch: string;
  uploadDraft: UploadDraft;
  onApprove: (documentId: string, allowOverwrite?: boolean) => Promise<void>;
  onClassifyDocument: () => Promise<void>;
  onConfigSave: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onInviteSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onLeasingSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onProfileSave: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onTaskCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onTenantSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUserAdmin: (action: "reset_password" | "delete_user" | "update_user") => Promise<void>;
  onUploadSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

function PageRenderer(props: PageRendererProps) {
  const {
    activePage,
    communications,
    configDraft,
    documents,
    inviteDraft,
    invites,
    leasingDraft,
    leasingIntel,
    managedUserDraft,
    overviewMetrics,
    pendingApproval,
    pendingConflicts,
    pendingDocuments,
    profileDraft,
    profiles,
    selectedTenant,
    revenueResults,
    revenueSearch,
    revenueSummary,
    savingState,
    setConfigDraft,
    setInviteDraft,
    setLeasingDraft,
    setManagedUserDraft,
    setProfileDraft,
    setRevenueSearch,
    setShowInvitePermissions,
    setShowProfileConfirmPassword,
    setShowProfilePassword,
    setSelectedTenantId,
    setTenantDetailState,
    setTaskDraft,
    setTenantPage,
    setTenantPageSize,
    setTenantDraft,
    setTenantSearch,
    setUploadDraft,
    showInvitePermissions,
    showProfileConfirmPassword,
    showProfilePassword,
    taskDraft,
    tasks,
    tenantDraft,
    tenantPage,
    tenantPageCount,
    tenantPageSize,
    paginatedTenantResults,
    tenantSearch,
    uploadDraft,
    onApprove,
    onClassifyDocument,
    onConfigSave,
    onInviteSubmit,
    onLeasingSubmit,
    onProfileSave,
    onTaskCreate,
    onTenantSubmit,
    onUserAdmin,
    onUploadSubmit,
  } = props;

  if (activePage === "Profile") {
    return (
      <section className="content-grid balanced">
        <article className="panel form-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Profile</p>
              <h3>Account and workspace preferences</h3>
            </div>
          </div>
          <form className="form-stack" onSubmit={onProfileSave}>
            <div className="field-row">
              <label className="field">
                <span>Full Name</span>
                <input value={profileDraft.fullName} onChange={(event) => setProfileDraft((draft) => ({ ...draft, fullName: event.target.value }))} />
              </label>
              <label className="field">
                <span>Username</span>
                <input value={profileDraft.username} onChange={(event) => setProfileDraft((draft) => ({ ...draft, username: event.target.value }))} />
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span>Email</span>
                <input type="email" value={profileDraft.email} onChange={(event) => setProfileDraft((draft) => ({ ...draft, email: event.target.value }))} />
                <small>Changing this will require re-verification once email delivery is fully configured.</small>
              </label>
              <label className="field">
                <span>Phone Number</span>
                <input value={profileDraft.phoneNumber} onChange={(event) => setProfileDraft((draft) => ({ ...draft, phoneNumber: event.target.value }))} />
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span>Timezone</span>
                <select value={profileDraft.timezone} onChange={(event) => setProfileDraft((draft) => ({ ...draft, timezone: event.target.value }))}>
                  {["Asia/Kolkata", "UTC", "Asia/Dubai", "Europe/London", "America/New_York"].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Status</span>
                <select value={profileDraft.status} onChange={(event) => setProfileDraft((draft) => ({ ...draft, status: event.target.value }))}>
                  {["available", "away", "PTO"].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>
            {profileDraft.status === "PTO" ? (
              <div className="field-row">
                <label className="field">
                  <span>PTO From</span>
                  <input type="date" value={profileDraft.ptoFrom} onChange={(event) => setProfileDraft((draft) => ({ ...draft, ptoFrom: event.target.value }))} />
                </label>
                <label className="field">
                  <span>PTO To</span>
                  <input type="date" value={profileDraft.ptoTo} onChange={(event) => setProfileDraft((draft) => ({ ...draft, ptoTo: event.target.value }))} />
                </label>
              </div>
            ) : null}
            <label className="field">
              <span>Theme</span>
              <select value={profileDraft.theme} onChange={(event) => setProfileDraft((draft) => ({ ...draft, theme: event.target.value }))}>
                <option value="dualtone">Dualtone Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <div className="field-row">
              <label className="field">
                <span>New Password</span>
                <input type={showProfilePassword ? "text" : "password"} value={profileDraft.newPassword} onChange={(event) => setProfileDraft((draft) => ({ ...draft, newPassword: event.target.value }))} />
              </label>
              <label className="field">
                <span>Confirm Password</span>
                <input type={showProfileConfirmPassword ? "text" : "password"} value={profileDraft.confirmPassword} onChange={(event) => setProfileDraft((draft) => ({ ...draft, confirmPassword: event.target.value }))} />
              </label>
            </div>
            <div className="field-row">
              <label className="checkbox-field compact-check">
                <input checked={showProfilePassword} onChange={(event) => setShowProfilePassword(event.target.checked)} type="checkbox" />
                <span>Show new password</span>
              </label>
              <label className="checkbox-field compact-check">
                <input checked={showProfileConfirmPassword} onChange={(event) => setShowProfileConfirmPassword(event.target.checked)} type="checkbox" />
                <span>Show confirmation</span>
              </label>
            </div>
            <p className={`match-copy ${profileDraft.newPassword && profileDraft.confirmPassword && profileDraft.newPassword === profileDraft.confirmPassword ? "good" : "warn"}`}>
              {profileDraft.newPassword || profileDraft.confirmPassword
                ? profileDraft.newPassword === profileDraft.confirmPassword
                  ? "Passwords match."
                  : "Passwords do not match yet."
                : "Leave password blank if you are not changing it."}
            </p>
            <button className="primary-button full-width" disabled={savingState === "profile"} type="submit">
              {savingState === "profile" ? "Saving…" : "Save profile"}
            </button>
          </form>
        </article>
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Account Notes</p>
              <h3>Invite-only access</h3>
            </div>
          </div>
          <div className="thread-list">
            <div className="thread-card">
              <strong>Password control</strong>
              <p>First-login password reset is enforced before workspace access.</p>
            </div>
            <div className="thread-card">
              <strong>Permission-scoped navigation</strong>
              <p>The sidebar only shows modules your role or explicit permissions allow.</p>
            </div>
          </div>
        </article>
      </section>
    );
  }

  if (activePage === "Overview") {
    return (
      <>
        <section className="metrics-grid four-up">
          {overviewMetrics.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} value={metric.value} note={metric.note} />
          ))}
        </section>
        <section className="content-grid balanced">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Task Pulse</p>
                <h3>Operational queue</h3>
              </div>
            </div>
            <div className="thread-list">
              {tasks.length > 0 ? (
                tasks.slice(0, 6).map((task) => (
                  <div className="thread-card" key={task.id}>
                    <strong>{task.title}</strong>
                    <p>{task.department || "Unassigned department"} • {task.priority || "No priority set"}</p>
                    <small>{task.assignedToName || "Unassigned"} • SLA {formatDate(task.slaDueAt)}</small>
                  </div>
                ))
              ) : (
                <div className="empty-row">No tasks are in the queue yet.</div>
              )}
            </div>
          </article>
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Memory Intake</p>
                <h3>Documents and approvals</h3>
              </div>
            </div>
            <div className="thread-list">
              {documents.length > 0 ? (
                documents.slice(0, 5).map((document) => (
                  <div className="thread-card" key={document.id}>
                    <div className="thread-topline">
                      <strong>{document.fileName}</strong>
                      <span className={`badge ${getDocumentBadge(document.status)}`}>
                        {document.status}
                      </span>
                    </div>
                    <p>{document.domainCategory || "Uncategorized"} • {document.subCategory || "No sub-category"}</p>
                    <small>{document.isInCoreMemory ? "In core memory" : "Awaiting memory admission"}</small>
                  </div>
                ))
              ) : (
                <div className="empty-row">No approved documents or uploads yet.</div>
              )}
            </div>
          </article>
        </section>
      </>
    );
  }

  if (activePage === "Tenants") {
    return (
      <section className="content-grid balanced">
        <article className="panel wide-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Tenant Master</p>
              <h3>Existing and new tenants</h3>
            </div>
            <div className="toolbar-row">
              <input
                className="search-input"
                placeholder="Search brand, unit, company"
                value={tenantSearch}
                onChange={(event) => setTenantSearch(event.target.value)}
              />
              <select className="page-size-select" value={tenantPageSize} onChange={(event) => setTenantPageSize(Number(event.target.value))}>
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>{size} / page</option>
                ))}
              </select>
            </div>
          </div>
          <div className="tenant-list">
            {paginatedTenantResults.map((tenant) => (
              <button
                className={`tenant-row interactive-row ${selectedTenant?.id === tenant.id ? "selected" : ""}`}
                key={tenant.id}
                onClick={() => {
                  setSelectedTenantId(tenant.id);
                  setTenantDetailState({ open: true, tenantId: tenant.id });
                }}
                type="button"
              >
                <div>
                  <strong>{tenant.brandName}</strong>
                  <p>
                    {tenant.unitCode} • {tenant.categoryPrimary || "Uncategorized"} • {tenant.parentCompany || "Parent company missing"}
                  </p>
                </div>
                <span>{formatCurrency(tenant.rent)}</span>
              </button>
            ))}
          </div>
          <div className="tenant-pagination">
            <button className="secondary-button" disabled={tenantPage <= 1} onClick={() => setTenantPage((page) => Math.max(1, page - 1))} type="button">
              Previous
            </button>
            <span>Page {tenantPage} of {tenantPageCount}</span>
            <button className="secondary-button" disabled={tenantPage >= tenantPageCount} onClick={() => setTenantPage((page) => Math.min(tenantPageCount, page + 1))} type="button">
              Next
            </button>
          </div>
        </article>
        <article className="panel form-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Add New Tenant</p>
              <h3>Workbook-driven intake</h3>
            </div>
          </div>
          <form className="form-stack" onSubmit={onTenantSubmit}>
            {tenantWorkbookSections.map((section) => (
              <WorkbookSectionForm
                key={section.title}
                section={section}
                values={tenantDraft}
                onChange={(key, value) => setTenantDraft((draft) => ({ ...draft, [key]: value }))}
              />
            ))}
            <button className="primary-button full-width" disabled={savingState === "tenant"} type="submit">
              {savingState === "tenant" ? "Saving…" : "Add new tenant"}
            </button>
          </form>
        </article>
      </section>
    );
  }

  if (activePage === "Revenue") {
    return (
      <>
        <section className="metrics-grid four-up">
          <MetricCard label="Tracked Rent Base" value={formatCompactCurrency(revenueSummary.total)} note="Current live total" />
          <MetricCard label="Average Rent" value={formatCompactCurrency(revenueSummary.average)} note="Average tenant rent" />
          <MetricCard label="Top 5 Share" value={`${revenueSummary.topFiveShare}%`} note="Portfolio concentration" />
          <MetricCard label="Billing Collection" value="Deferred" note="Future sprint" />
        </section>
        <section className="content-grid balanced">
          <article className="panel wide-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Brand Search</p>
                <h3>Revenue breakdown</h3>
              </div>
              <input
                className="search-input"
                placeholder="Type a brand to inspect"
                value={revenueSearch}
                onChange={(event) => setRevenueSearch(event.target.value)}
              />
            </div>
            <div className="tenant-list">
              {revenueResults.map((tenant) => (
                <div className="tenant-row" key={tenant.id}>
                  <div>
                    <strong>{tenant.brandName}</strong>
                    <p>
                      {tenant.unitCode} • {tenant.categoryPrimary || "No category"} • Lease expiry {formatDate(tenant.leaseExpiryDate)}
                    </p>
                  </div>
                  <span>{formatCurrency(tenant.rent)}</span>
                </div>
              ))}
            </div>
          </article>
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Top Rent Contributors</p>
                <h3>Highest-value brands</h3>
              </div>
            </div>
            <div className="thread-list">
              {revenueSummary.topFive.map((tenant) => (
                <div className="thread-card" key={tenant.id}>
                  <strong>{tenant.brandName}</strong>
                  <p>{tenant.unitCode}</p>
                  <small>{formatCurrency(tenant.rent)}</small>
                </div>
              ))}
            </div>
          </article>
        </section>
      </>
    );
  }

  if (activePage === "Tasks") {
    return (
      <section className="content-grid balanced">
        <article className="panel wide-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Live Tasks</p>
              <h3>Operational queue</h3>
            </div>
          </div>
          <div className="thread-list">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <div className="thread-card" key={task.id}>
                  <div className="thread-topline">
                    <strong>{task.title}</strong>
                    <span className="badge neutral">{task.status || "open"}</span>
                  </div>
                  <p>{task.department || "No department"} • {task.priority || "No priority"}</p>
                  <small>{task.assignedToName || "Unassigned"} • SLA {formatDate(task.slaDueAt)}</small>
                </div>
              ))
            ) : (
              <div className="empty-row">No tasks created yet.</div>
            )}
          </div>
        </article>
        <article className="panel form-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Create Task</p>
              <h3>Route and assign</h3>
            </div>
          </div>
          <form className="form-stack" onSubmit={onTaskCreate}>
            <label className="field">
              <span>Title</span>
              <input value={taskDraft.title} onChange={(event) => setTaskDraft((draft) => ({ ...draft, title: event.target.value }))} />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea value={taskDraft.description} onChange={(event) => setTaskDraft((draft) => ({ ...draft, description: event.target.value }))} rows={3} />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Department</span>
                <select value={taskDraft.department} onChange={(event) => setTaskDraft((draft) => ({ ...draft, department: event.target.value }))}>
                  {["facilities", "finance", "leasing", "operations"].map((option) => (
                    <option key={option} value={option}>{toTitle(option)}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Priority</span>
                <select value={taskDraft.priority} onChange={(event) => setTaskDraft((draft) => ({ ...draft, priority: event.target.value }))}>
                  {["P1", "P2", "P3"].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Assign To</span>
              <select value={taskDraft.assignedToId} onChange={(event) => setTaskDraft((draft) => ({ ...draft, assignedToId: event.target.value }))}>
                <option value="">Unassigned</option>
                {profiles.map((profile) => (
                  <option
                    disabled={String(profile.availabilityStatus || "").toLowerCase() === "pto"}
                    key={profile.id}
                    value={profile.id}
                  >
                    {profile.fullName}
                    {String(profile.availabilityStatus || "").toLowerCase() === "pto"
                      ? ` (PTO ${profile.ptoFrom ? formatDate(profile.ptoFrom) : ""}${profile.ptoTo ? ` to ${formatDate(profile.ptoTo)}` : ""})`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>SLA Due At</span>
              <input type="datetime-local" value={taskDraft.slaDueAt} onChange={(event) => setTaskDraft((draft) => ({ ...draft, slaDueAt: event.target.value }))} />
            </label>
            <label className="checkbox-field">
              <input checked={taskDraft.proofRequired} onChange={(event) => setTaskDraft((draft) => ({ ...draft, proofRequired: event.target.checked }))} type="checkbox" />
              <span>Proof of completion is optional for this task</span>
            </label>
            <button className="primary-button full-width" disabled={savingState === "task"} type="submit">
              {savingState === "task" ? "Creating…" : "Create task"}
            </button>
          </form>
        </article>
      </section>
    );
  }

  if (activePage === "Communications") {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Communication Ledger</p>
            <h3>Status tracking</h3>
          </div>
        </div>
        <div className="thread-list">
          {communications.length > 0 ? (
            communications.map((thread) => (
              <div className="thread-card" key={thread.id}>
                <div className="thread-topline">
                  <strong>{thread.subject || thread.purpose}</strong>
                  <span className={`badge ${getCommunicationBadge(thread.currentStatus)}`}>{thread.currentStatus}</span>
                </div>
                <p>{thread.recipientName} • {toTitle(thread.channel)} • {thread.purpose}</p>
                <small>{thread.bodyPreview || "No preview"} • SLA {formatDate(thread.slaDueAt)}</small>
              </div>
            ))
          ) : (
            <div className="empty-row">No communications are live yet.</div>
          )}
        </div>
      </section>
    );
  }

  if (activePage === "Document Vault") {
    return (
      <section className="content-grid balanced">
        <article className="panel wide-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Uploaded Documents</p>
              <h3>Vault inventory</h3>
            </div>
          </div>
          <div className="thread-list">
            {documents.length > 0 ? (
              documents.map((document) => (
                <div className="thread-card" key={document.id}>
                  <div className="thread-topline">
                    <strong>{document.fileName}</strong>
                    <span className={`badge ${getDocumentBadge(document.status)}`}>{document.status}</span>
                  </div>
                  <p>{document.domainCategory || "Uncategorized"} • {document.subCategory || "No sub-category"}</p>
                  <small>{document.purposeSummary || document.parserSummary || "Awaiting purpose and review"}</small>
                </div>
              ))
            ) : (
              <div className="empty-row">No documents uploaded yet.</div>
            )}
          </div>
        </article>
        <article className="panel form-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Upload Document</p>
              <h3>Stage for approval</h3>
            </div>
          </div>
          <form className="form-stack" onSubmit={onUploadSubmit}>
            <label className="field">
              <span>File</span>
              <input type="file" accept=".pdf,.xlsx,.xls" onChange={(event) => setUploadDraft((draft) => ({ ...draft, file: event.target.files?.[0] || null }))} />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea rows={3} value={uploadDraft.notes} onChange={(event) => setUploadDraft((draft) => ({ ...draft, notes: event.target.value }))} />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Domain</span>
                <select value={uploadDraft.domainCategory} onChange={(event) => setUploadDraft((draft) => ({ ...draft, domainCategory: event.target.value }))}>
                  {documentDomainOptions.map((option) => (
                    <option key={option.domain} value={option.domain}>{toTitle(option.domain)}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Sub-category</span>
                <select value={uploadDraft.subCategory} onChange={(event) => setUploadDraft((draft) => ({ ...draft, subCategory: event.target.value }))}>
                  {(documentDomainOptions.find((option) => option.domain === uploadDraft.domainCategory)?.subcategories ?? []).map((option) => (
                    <option key={option} value={option}>{toTitle(option)}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Purpose Summary</span>
              <input value={uploadDraft.purposeSummary} onChange={(event) => setUploadDraft((draft) => ({ ...draft, purposeSummary: event.target.value }))} />
            </label>
            <div className="button-row">
              <button className="secondary-button" disabled={savingState === "classify"} onClick={() => void onClassifyDocument()} type="button">
                {savingState === "classify" ? "Thinking…" : "Ask Vetturo"}
              </button>
              <button className="primary-button" disabled={savingState === "document"} type="submit">
                {savingState === "document" ? "Uploading…" : "Upload to vault"}
              </button>
            </div>
          </form>
        </article>
      </section>
    );
  }

  if (activePage === "Leasing Intel") {
    return (
      <section className="content-grid balanced">
        <article className="panel wide-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Decision DNA</p>
              <h3>Live evaluations</h3>
            </div>
          </div>
          <div className="thread-list">
            {leasingIntel.length > 0 ? (
              leasingIntel.map((item) => (
                <div className="thread-card" key={item.id}>
                  <div className="thread-topline">
                    <strong>{item.candidateBrandName}</strong>
                    <span className={`badge ${item.totalScore >= 70 ? "good" : "warn"}`}>{item.recommendation}</span>
                  </div>
                  <p>{item.category} • Score {item.totalScore}</p>
                  <small>Synergy {item.categorySynergy} • Technical {item.technicalFit} • Financial {item.financialHealth} • Cannibalization {item.cannibalizationRisk}</small>
                </div>
              ))
            ) : (
              <div className="empty-row">No Decision DNA entries yet.</div>
            )}
          </div>
        </article>
        <article className="panel form-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">New Brand Vetting</p>
              <h3>Create evaluation</h3>
            </div>
          </div>
          <form className="form-stack" onSubmit={onLeasingSubmit}>
            <label className="field">
              <span>Candidate Brand</span>
              <input value={leasingDraft.candidateBrandName} onChange={(event) => setLeasingDraft((draft) => ({ ...draft, candidateBrandName: event.target.value }))} />
            </label>
            <label className="field">
              <span>Category</span>
              <input value={leasingDraft.category} onChange={(event) => setLeasingDraft((draft) => ({ ...draft, category: event.target.value }))} />
            </label>
            {[
              ["Category Synergy", "categorySynergy"],
              ["Technical Fit", "technicalFit"],
              ["Financial Health", "financialHealth"],
              ["Cannibalization Risk", "cannibalizationRisk"],
            ].map(([label, key]) => (
              <label className="field" key={key}>
                <span>{label}</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={String(leasingDraft[key as keyof LeasingDraft])}
                  onChange={(event) =>
                    setLeasingDraft((draft) => ({
                      ...draft,
                      [key]: Number(event.target.value),
                    }))
                  }
                />
              </label>
            ))}
            <button className="primary-button full-width" disabled={savingState === "leasing"} type="submit">
              {savingState === "leasing" ? "Saving…" : "Save evaluation"}
            </button>
          </form>
        </article>
      </section>
    );
  }

  if (activePage === "Approvals") {
    return (
      <section className="content-grid balanced">
        <article className="panel wide-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Approval Queue</p>
              <h3>Pending documents</h3>
            </div>
          </div>
          <div className="thread-list">
            {pendingDocuments.length > 0 ? (
              pendingDocuments.map((document) => (
                <div className="thread-card" key={document.id}>
                  <div className="thread-topline">
                    <strong>{document.fileName}</strong>
                    <span className={`badge ${getDocumentBadge(document.status)}`}>{document.status}</span>
                  </div>
                  <p>{document.domainCategory || "Uncategorized"} • {document.subCategory || "No sub-category"}</p>
                  <small>{document.purposeSummary || "No purpose summary yet"}</small>
                  <div className="button-row top-gap">
                    <button className="primary-button" disabled={savingState === "approve"} onClick={() => void onApprove(document.id)} type="button">
                      Approve into memory
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-row">No documents awaiting approval.</div>
            )}
          </div>
        </article>
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Conflict Review</p>
              <h3>Overwrite confirmation</h3>
            </div>
          </div>
          {pendingApproval ? (
            <div className="thread-card">
              <strong>{pendingApproval.fileName}</strong>
              <p>Conflicting fields detected: {pendingConflicts.join(", ")}</p>
              <button className="primary-button top-gap" onClick={() => void onApprove(pendingApproval.id, true)} type="button">
                Approve and overwrite
              </button>
            </div>
          ) : (
            <div className="empty-row">No overwrite confirmation needed right now.</div>
          )}
        </article>
      </section>
    );
  }

  if (activePage === "Invite User") {
    return (
      <section className="content-grid balanced">
        <article className="panel form-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Invite User</p>
              <h3>Invite-only access</h3>
            </div>
          </div>
          <form className="form-stack" onSubmit={onInviteSubmit}>
            <div className="field-row">
              <label className="field">
                <span>Full Name</span>
                <input value={inviteDraft.fullName} onChange={(event) => setInviteDraft((draft) => ({ ...draft, fullName: event.target.value }))} />
              </label>
              <label className="field">
                <span>Username</span>
                <input value={inviteDraft.username} onChange={(event) => setInviteDraft((draft) => ({ ...draft, username: event.target.value }))} />
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span>Email</span>
                <input type="email" value={inviteDraft.email} onChange={(event) => setInviteDraft((draft) => ({ ...draft, email: event.target.value }))} />
              </label>
              <label className="field">
                <span>Phone Number</span>
                <input value={inviteDraft.phoneNumber} onChange={(event) => setInviteDraft((draft) => ({ ...draft, phoneNumber: event.target.value }))} />
              </label>
            </div>
            <label className="field">
              <span>Department / Persona</span>
              <select value={inviteDraft.role} onChange={(event) => setInviteDraft((draft) => ({ ...draft, role: event.target.value }))}>
                {["super_admin", "mall_manager", "leasing_manager", "finance", "facilities"].map((option) => (
                  <option key={option} value={option}>{toTitle(option)}</option>
                ))}
              </select>
            </label>
            {!showInvitePermissions ? (
              <button className="secondary-button full-width" onClick={() => setShowInvitePermissions(true)} type="button">
                Next: choose permissions
              </button>
            ) : (
              <>
                <div className="permission-grid">
                  {invitePermissionOptions.map((permission) => (
                    <label className="checkbox-field" key={permission}>
                      <input
                        checked={inviteDraft.permissions.includes(permission)}
                        onChange={(event) =>
                          setInviteDraft((draft) => ({
                            ...draft,
                            permissions: event.target.checked
                              ? [...draft.permissions, permission]
                              : draft.permissions.filter((item) => item !== permission),
                          }))
                        }
                        type="checkbox"
                      />
                      <span>{toTitle(permission)}</span>
                    </label>
                  ))}
                </div>
                <button className="primary-button full-width" disabled={savingState === "invite"} type="submit">
                  {savingState === "invite" ? "Sending…" : "Submit invite"}
                </button>
              </>
            )}
          </form>
        </article>
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">User Admin</p>
              <h3>Invites and live users</h3>
            </div>
          </div>
          <div className="thread-list">
            {invites.length > 0 ? (
              invites.map((invite) => (
                <div className="thread-card" key={invite.id}>
                  <div className="thread-topline">
                    <strong>{invite.fullName || invite.email}</strong>
                    <span className={`badge ${invite.acceptedAt ? "good" : "warn"}`}>{invite.role}</span>
                  </div>
                  <p>{invite.email}</p>
                  <small>{invite.acceptedAt ? "Accepted" : "Awaiting acceptance"} • {invite.permissions.join(", ")}</small>
                </div>
              ))
            ) : (
              <div className="empty-row">No invites issued yet.</div>
            )}
          </div>
          <div className="thread-list top-gap">
            {profiles.map((profile) => (
              <button
                className={`thread-card interactive-row ${managedUserDraft.userId === profile.id ? "selected" : ""}`}
                key={profile.id}
                onClick={() =>
                  setManagedUserDraft({
                    userId: profile.id,
                    email: profile.email,
                    fullName: profile.fullName,
                    username: profile.username || "",
                    phoneNumber: profile.phoneNumber || "",
                    role: profile.role,
                    permissions: profile.permissions,
                  })
                }
                type="button"
              >
                <div className="thread-topline">
                  <strong>{profile.fullName}</strong>
                  <span className="badge neutral">{toTitle(profile.role)}</span>
                </div>
                <p>{profile.email}</p>
                <small>{profile.permissions.join(", ") || "No explicit permissions"}</small>
              </button>
            ))}
          </div>
          {managedUserDraft.userId ? (
            <form className="form-stack top-gap" onSubmit={(event) => { event.preventDefault(); void onUserAdmin("update_user"); }}>
              <div className="field-row">
                <label className="field">
                  <span>Full Name</span>
                  <input value={managedUserDraft.fullName} onChange={(event) => setManagedUserDraft((draft) => ({ ...draft, fullName: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Username</span>
                  <input value={managedUserDraft.username} onChange={(event) => setManagedUserDraft((draft) => ({ ...draft, username: event.target.value }))} />
                </label>
              </div>
              <div className="field-row">
                <label className="field">
                  <span>Phone</span>
                  <input value={managedUserDraft.phoneNumber} onChange={(event) => setManagedUserDraft((draft) => ({ ...draft, phoneNumber: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Role</span>
                  <select value={managedUserDraft.role} onChange={(event) => setManagedUserDraft((draft) => ({ ...draft, role: event.target.value }))}>
                    {["super_admin", "mall_manager", "leasing_manager", "finance", "facilities"].map((option) => (
                      <option key={option} value={option}>{toTitle(option)}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="permission-grid">
                {invitePermissionOptions.map((permission) => (
                  <label className="checkbox-field" key={permission}>
                    <input
                      checked={managedUserDraft.permissions.includes(permission)}
                      onChange={(event) =>
                        setManagedUserDraft((draft) => ({
                          ...draft,
                          permissions: event.target.checked
                            ? [...draft.permissions, permission]
                            : draft.permissions.filter((item) => item !== permission),
                        }))
                      }
                      type="checkbox"
                    />
                    <span>{toTitle(permission)}</span>
                  </label>
                ))}
              </div>
              <div className="button-row">
                <button className="primary-button" disabled={savingState === "user-admin"} type="submit">
                  Save user
                </button>
                <button className="secondary-button" disabled={savingState === "user-admin"} onClick={() => void onUserAdmin("reset_password")} type="button">
                  Reset password
                </button>
              </div>
              <button className="secondary-button full-width danger-button" disabled={savingState === "user-admin"} onClick={() => void onUserAdmin("delete_user")} type="button">
                Delete user
              </button>
            </form>
          ) : null}
        </article>
      </section>
    );
  }

  return (
    <section className="content-grid balanced">
      <article className="panel form-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">{activePage === "Configs" ? "Configs" : "Settings"}</p>
            <h3>{activePage === "Configs" ? "Thresholds and refresh" : "Settings"}</h3>
          </div>
        </div>
        <form className="form-stack" onSubmit={onConfigSave}>
          <div className="field-row">
            <label className="field">
              <span>P1 Alert Threshold (mins)</span>
              <input
                type="number"
                value={configDraft.alertThresholdP1Minutes}
                onChange={(event) => setConfigDraft((draft) => ({ ...draft, alertThresholdP1Minutes: Number(event.target.value) }))}
              />
            </label>
            <label className="field">
              <span>P2 Alert Threshold (mins)</span>
              <input
                type="number"
                value={configDraft.alertThresholdP2Minutes}
                onChange={(event) => setConfigDraft((draft) => ({ ...draft, alertThresholdP2Minutes: Number(event.target.value) }))}
              />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>P3 Alert Threshold (mins)</span>
              <input
                type="number"
                value={configDraft.alertThresholdP3Minutes}
                onChange={(event) => setConfigDraft((draft) => ({ ...draft, alertThresholdP3Minutes: Number(event.target.value) }))}
              />
            </label>
            <label className="field">
              <span>Data Refresh (mins)</span>
              <input
                type="number"
                min="15"
                max="30"
                value={configDraft.dataRefreshMinutes}
                onChange={(event) => setConfigDraft((draft) => ({ ...draft, dataRefreshMinutes: Number(event.target.value) }))}
              />
            </label>
          </div>
          <label className="checkbox-field">
            <input checked={configDraft.autoEscalationEnabled} onChange={(event) => setConfigDraft((draft) => ({ ...draft, autoEscalationEnabled: event.target.checked }))} type="checkbox" />
            <span>Enable automatic escalation logic</span>
          </label>
          <label className="checkbox-field">
            <input checked={configDraft.emailEnabled} onChange={(event) => setConfigDraft((draft) => ({ ...draft, emailEnabled: event.target.checked }))} type="checkbox" />
            <span>Enable email communications</span>
          </label>
          <label className="checkbox-field">
            <input checked={configDraft.whatsappEnabled} onChange={(event) => setConfigDraft((draft) => ({ ...draft, whatsappEnabled: event.target.checked }))} type="checkbox" />
            <span>Enable WhatsApp communications</span>
          </label>
          <label className="checkbox-field">
            <input checked={configDraft.botApprovalProbeEnabled} onChange={(event) => setConfigDraft((draft) => ({ ...draft, botApprovalProbeEnabled: event.target.checked }))} type="checkbox" />
            <span>Ask probing questions during document approval</span>
          </label>
          <button className="primary-button full-width" disabled={savingState === "config"} type="submit">
            {savingState === "config" ? "Saving…" : "Save configs"}
          </button>
        </form>
      </article>
      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Live Notes</p>
            <h3>Production behavior</h3>
          </div>
        </div>
        <div className="thread-list">
          <div className="thread-card">
            <strong>Refresh cadence</strong>
            <p>The app refreshes on-demand and on the configured interval. Vercel cron also pings the refresh endpoint every 15 minutes.</p>
          </div>
          <div className="thread-card">
            <strong>Invite-only auth</strong>
            <p>There is no signup path. User creation lives behind the secure invite flow and login uses Supabase password auth.</p>
          </div>
        </div>
      </article>
    </section>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function BarMetric({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div className="bar-metric">
      <div className="bar-metric-copy">
        <span>{label}</span>
        <strong>{Number.isFinite(value) ? value : 0}</strong>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function WorkbookSectionForm({
  section,
  values,
  onChange,
}: {
  section: WorkbookSection;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <section className="subform">
      <p className="section-kicker">{section.title}</p>
      <div className="form-grid">
        {section.fields.map((field) => (
          <label className="field" key={field.key}>
            <span>{field.label}</span>
            {getTenantFieldOptions(field.key).length > 0 ? (
              <select value={values[field.key] ?? ""} onChange={(event) => onChange(field.key, event.target.value)}>
                <option value="">Select</option>
                {getTenantFieldOptions(field.key).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input value={values[field.key] ?? ""} onChange={(event) => onChange(field.key, event.target.value)} />
            )}
            <small>{field.description}</small>
          </label>
        ))}
      </div>
    </section>
  );
}

export default App;
