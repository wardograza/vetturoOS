import { supabase } from "./supabase";
import { organizationWorkbookSections, tenantWorkbookSections } from "./workbookSchema";
import type {
  AppConfigRecord,
  AuthProfile,
  CommunicationRecord,
  DecisionDnaRecord,
  DocumentRecord,
  InviteRecord,
  OnboardingGap,
  OrganizationProfile,
  TaskRecord,
  TenantProfile,
  TenantRow,
  WorkspaceData,
} from "../types";

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function mapLegacyTenantRow(row: TenantRow, index: number): TenantProfile {
  return {
    id: `legacy-${index}`,
    brandName: row.tenant_name?.trim() || "Unnamed Tenant",
    unitCode: row.unit_number?.trim() || "Unassigned",
    rent: typeof row.rent === "number" ? row.rent : 0,
    parentCompany: null,
    categoryPrimary: null,
    categorySecondary: null,
    brandGrade: null,
    brandPocName: null,
    brandPocEmail: null,
    storeManagerName: null,
    storeManagerPhone: null,
    billingContactEmail: null,
    nexusLeasingLead: null,
    leaseStartDate: null,
    leaseExpiryDate: null,
    mgRentMonthly: typeof row.rent === "number" ? row.rent : null,
    gtoPercent: null,
    securityDeposit: null,
    unitGlaSba: null,
    powerLoadKva: null,
    gasConnectionYn: null,
    waterInletYn: null,
    exhaustProvisionYn: null,
    insuranceExpiry: null,
    tradeLicenseExpiry: null,
    lastAuditScore: null,
    sourcePayload: {
      Brand_Name: row.tenant_name,
      Unit_Code: row.unit_number,
      MG_Rent_Monthly: row.rent,
    },
  };
}

function mapTenantProfile(row: Record<string, unknown>): TenantProfile {
  const payload = (row.source_payload as Record<string, string | number | boolean | null>) ?? {};

  return {
    id: String(row.id),
    brandName: String(row.brand_name ?? payload.Brand_Name ?? "Unnamed Tenant"),
    unitCode: String(row.unit_code ?? payload.Unit_Code ?? "Unassigned"),
    rent: toNumber(row.rent_amount ?? row.mg_rent_monthly ?? payload.MG_Rent_Monthly) ?? 0,
    parentCompany: (row.parent_company as string | null) ?? (payload.Parent_Company as string | null) ?? null,
    categoryPrimary:
      (row.category_primary as string | null) ?? (payload.Category_Primary as string | null) ?? null,
    categorySecondary:
      (row.category_secondary as string | null) ?? (payload.Category_Secondary as string | null) ?? null,
    brandGrade: (row.brand_grade as string | null) ?? (payload.Brand_Grade as string | null) ?? null,
    brandPocName: (row.brand_poc_name as string | null) ?? (payload.Brand_POC_Name as string | null) ?? null,
    brandPocEmail: (row.brand_poc_email as string | null) ?? (payload.Brand_POC_Email as string | null) ?? null,
    storeManagerName:
      (row.store_manager_name as string | null) ?? (payload.Store_Manager_Name as string | null) ?? null,
    storeManagerPhone:
      (row.store_manager_phone as string | null) ?? (payload.Store_Manager_Phone as string | null) ?? null,
    billingContactEmail:
      (row.billing_contact_email as string | null) ?? (payload.Billing_Contact_Email as string | null) ?? null,
    nexusLeasingLead:
      (row.nexus_leasing_lead as string | null) ?? (payload.Nexus_Leasing_Lead as string | null) ?? null,
    leaseStartDate:
      (row.lease_start_date as string | null) ?? (payload.Lease_Start_Date as string | null) ?? null,
    leaseExpiryDate:
      (row.lease_expiry_date as string | null) ?? (payload.Lease_Expiry_Date as string | null) ?? null,
    mgRentMonthly: toNumber(row.mg_rent_monthly ?? payload.MG_Rent_Monthly),
    gtoPercent: toNumber(row.gto_percent ?? payload.GTO_Percent),
    securityDeposit: toNumber(row.security_deposit ?? payload.Security_Deposit),
    unitGlaSba: toNumber(row.unit_gla_sba ?? payload.Unit_GLA_SBA),
    powerLoadKva: toNumber(row.power_load_kva ?? payload.Power_Load_kVA),
    gasConnectionYn:
      (row.gas_connection_yn as string | null) ?? (payload.Gas_Connection_YN as string | null) ?? null,
    waterInletYn:
      (row.water_inlet_yn as string | null) ?? (payload.Water_Inlet_YN as string | null) ?? null,
    exhaustProvisionYn:
      (row.exhaust_provision_yn as string | null) ??
      (payload.Exhaust_Provision_YN as string | null) ??
      null,
    insuranceExpiry:
      (row.insurance_expiry as string | null) ?? (payload.Insurance_Expiry as string | null) ?? null,
    tradeLicenseExpiry:
      (row.trade_license_expiry as string | null) ??
      (payload.Trade_License_Expiry as string | null) ??
      null,
    lastAuditScore: toNumber(row.last_audit_score ?? payload.Last_Audit_Score),
    sourcePayload: payload,
  };
}

function mapOrganizationProfile(row: Record<string, unknown>): OrganizationProfile {
  const payload = (row.source_payload as Record<string, string | number | boolean | null>) ?? {};

  return {
    id: String(row.id),
    organizationName: String(row.organization_name ?? payload.Organization_Name ?? "Vetturo"),
    organizationCode:
      (row.organization_code as string | null) ?? (payload.Organization_Code as string | null) ?? null,
    orgWebsiteUrl:
      (row.org_website_url as string | null) ?? (payload.Org_Website_URL as string | null) ?? null,
    primaryBrandColor:
      (row.primary_brand_color as string | null) ??
      (payload.Primary_Brand_Color as string | null) ??
      null,
    secondaryBrandColor:
      (row.secondary_brand_color as string | null) ??
      (payload.Secondary_Brand_Color as string | null) ??
      null,
    portfolioSizeCount: toNumber(row.portfolio_size_count ?? payload.Portfolio_Size_Count),
    standardHoursOpen:
      (row.standard_hours_open as string | null) ??
      (payload.Standard_Hours_Open as string | null) ??
      null,
    standardHoursClose:
      (row.standard_hours_close as string | null) ??
      (payload.Standard_Hours_Close as string | null) ??
      null,
    onboardingLeadName:
      (row.onboarding_lead_name as string | null) ??
      (payload.Onboarding_Lead_Name as string | null) ??
      null,
    onboardingLeadEmail:
      (row.onboarding_lead_email as string | null) ??
      (payload.Onboarding_Lead_Email as string | null) ??
      null,
    sourcePayload: payload,
  };
}

async function safeSelect<T>(table: string, select: string): Promise<{ data: T[]; warning?: string }> {
  if (!supabase) {
    return { data: [], warning: "Supabase is not configured." };
  }

  const { data, error } = await supabase.from(table).select(select);

  if (error) {
    return { data: [], warning: `${table}: ${error.message}` };
  }

  return { data: (data ?? []) as T[] };
}

async function fetchTenantProfiles(): Promise<{ data: TenantProfile[]; warning?: string }> {
  const profileResult = await safeSelect<Record<string, unknown>>(
    "tenant_profiles",
    "id, brand_name, unit_code, rent_amount, parent_company, category_primary, category_secondary, brand_grade, brand_poc_name, brand_poc_email, store_manager_name, store_manager_phone, billing_contact_email, nexus_leasing_lead, lease_start_date, lease_expiry_date, mg_rent_monthly, gto_percent, security_deposit, unit_gla_sba, power_load_kva, gas_connection_yn, water_inlet_yn, exhaust_provision_yn, insurance_expiry, trade_license_expiry, last_audit_score, source_payload",
  );

  if (profileResult.data.length > 0) {
    return { data: profileResult.data.map(mapTenantProfile), warning: profileResult.warning };
  }

  const legacyResult = await safeSelect<TenantRow>("tenants", "tenant_name, unit_number, rent");
  return {
    data: legacyResult.data.map(mapLegacyTenantRow),
    warning: profileResult.warning ?? legacyResult.warning,
  };
}

function computeMissingFields(
  payload: Record<string, string | number | boolean | null>,
  requiredKeys: string[],
) {
  return requiredKeys.filter((key) => {
    const value = payload[key];
    return value === null || value === undefined || String(value).trim() === "";
  });
}

function buildOnboardingGaps(
  organization: OrganizationProfile | null,
  tenants: TenantProfile[],
): OnboardingGap[] {
  const gaps: OnboardingGap[] = [];

  const orgRequired = organizationWorkbookSections.flatMap((section) =>
    section.fields.filter((field) => field.required).map((field) => field.key),
  );

  if (!organization) {
    gaps.push({
      scope: "organization",
      recordLabel: "Organization profile",
      missingFields: orgRequired,
    });
  } else {
    const missing = computeMissingFields(organization.sourcePayload, orgRequired);
    if (missing.length > 0) {
      gaps.push({
        scope: "organization",
        recordLabel: organization.organizationName,
        missingFields: missing,
      });
    }
  }

  const tenantRequired = tenantWorkbookSections.flatMap((section) =>
    section.fields.filter((field) => field.required).map((field) => field.key),
  );

  tenants.forEach((tenant) => {
    const missing = computeMissingFields(tenant.sourcePayload, tenantRequired);
    if (missing.length > 0) {
      gaps.push({
        scope: "tenant",
        recordLabel: tenant.brandName,
        missingFields: missing,
      });
    }
  });

  return gaps;
}

export async function fetchWorkspaceData(): Promise<WorkspaceData> {
  const [
    organizationResult,
    tenantResult,
    tasksResult,
    communicationsResult,
    documentsResult,
    dnaResult,
    profilesResult,
    invitesResult,
    configResult,
  ] = await Promise.all([
    safeSelect<Record<string, unknown>>(
      "organization_profiles",
      "id, organization_name, organization_code, org_website_url, primary_brand_color, secondary_brand_color, portfolio_size_count, standard_hours_open, standard_hours_close, onboarding_lead_name, onboarding_lead_email, source_payload",
    ),
    fetchTenantProfiles(),
    safeSelect<Record<string, unknown>>(
      "tasks",
      "id, title, description, department, priority, status, assigned_to, proof_required, sla_due_at, created_at, assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name)",
    ),
    safeSelect<Record<string, unknown>>(
      "communications",
      "id, recipient_name, recipient_email, recipient_phone, channel, purpose, subject, body_preview, current_status, escalation_level, requires_action, sla_due_at, created_at",
    ),
    safeSelect<Record<string, unknown>>(
      "documents",
      "id, file_name, storage_path, document_type, domain_category, sub_category, purpose_summary, status, parser_summary, is_in_core_memory, conflict_count, uploaded_at, source_payload",
    ),
    safeSelect<Record<string, unknown>>(
      "decision_dna_scores",
      "id, candidate_brand_name, category, category_synergy, technical_fit, financial_health, cannibalization_risk, total_score, recommendation",
    ),
    safeSelect<Record<string, unknown>>(
      "profiles",
      "id, email, full_name, username, role, phone_number, permissions, must_reset_password, is_active",
    ),
    safeSelect<Record<string, unknown>>(
      "user_invites",
      "id, full_name, username, email, phone_number, role, permissions, expires_at, accepted_at",
    ),
    safeSelect<Record<string, unknown>>(
      "app_configs",
      "id, alert_threshold_p1_minutes, alert_threshold_p2_minutes, alert_threshold_p3_minutes, data_refresh_minutes, auto_escalation_enabled, email_enabled, whatsapp_enabled, bot_approval_probe_enabled, updated_at",
    ),
  ]);

  const warnings = [
    organizationResult.warning,
    tenantResult.warning,
    tasksResult.warning,
    communicationsResult.warning,
    documentsResult.warning,
    dnaResult.warning,
    profilesResult.warning,
    invitesResult.warning,
    configResult.warning,
  ].filter((warning): warning is string => Boolean(warning));

  const organization = organizationResult.data[0] ? mapOrganizationProfile(organizationResult.data[0]) : null;

  const tasks: TaskRecord[] = tasksResult.data.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    department: (row.department as string | null) ?? null,
    priority: (row.priority as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    assignedToId: (row.assigned_to as string | null) ?? null,
    assignedToName:
      (row.assigned_to_profile as { full_name?: string } | null)?.full_name ?? null,
    proofRequired: Boolean(row.proof_required),
    slaDueAt: (row.sla_due_at as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
  }));

  const communications: CommunicationRecord[] = communicationsResult.data.map((row) => ({
    id: String(row.id),
    recipientName: String(row.recipient_name),
    recipientEmail: (row.recipient_email as string | null) ?? null,
    recipientPhone: (row.recipient_phone as string | null) ?? null,
    channel: String(row.channel),
    purpose: String(row.purpose),
    subject: (row.subject as string | null) ?? null,
    bodyPreview: String(row.body_preview ?? ""),
    currentStatus: String(row.current_status),
    escalationLevel: toNumber(row.escalation_level) ?? 1,
    requiresAction: Boolean(row.requires_action),
    slaDueAt: (row.sla_due_at as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
  }));

  const documents: DocumentRecord[] = documentsResult.data.map((row) => ({
    id: String(row.id),
    fileName: String(row.file_name),
    storagePath: String(row.storage_path),
    documentType: String(row.document_type),
    domainCategory: (row.domain_category as string | null) ?? null,
    subCategory: (row.sub_category as string | null) ?? null,
    purposeSummary: (row.purpose_summary as string | null) ?? null,
    status: String(row.status),
    parserSummary: (row.parser_summary as string | null) ?? null,
    isInCoreMemory: Boolean(row.is_in_core_memory),
    conflictCount: toNumber(row.conflict_count) ?? 0,
    uploadedAt: (row.uploaded_at as string | null) ?? null,
    sourcePayload: (row.source_payload as Record<string, unknown> | null) ?? null,
  }));

  const decisionDna: DecisionDnaRecord[] = dnaResult.data.map((row) => ({
    id: String(row.id),
    candidateBrandName: String(row.candidate_brand_name),
    category: String(row.category),
    categorySynergy: toNumber(row.category_synergy) ?? 0,
    technicalFit: toNumber(row.technical_fit) ?? 0,
    financialHealth: toNumber(row.financial_health) ?? 0,
    cannibalizationRisk: toNumber(row.cannibalization_risk) ?? 0,
    totalScore: toNumber(row.total_score) ?? 0,
    recommendation: String(row.recommendation),
  }));

  const profiles: AuthProfile[] = profilesResult.data.map((row) => ({
    id: String(row.id),
    email: String(row.email),
    fullName: String(row.full_name),
    username: (row.username as string | null) ?? null,
    role: String(row.role),
    phoneNumber: (row.phone_number as string | null) ?? null,
    permissions: Array.isArray(row.permissions) ? (row.permissions as string[]) : [],
    mustResetPassword: Boolean(row.must_reset_password),
    isActive: Boolean(row.is_active),
  }));

  const invites: InviteRecord[] = invitesResult.data.map((row) => ({
    id: String(row.id),
    fullName: String(row.full_name ?? ""),
    username: (row.username as string | null) ?? null,
    email: String(row.email),
    phoneNumber: (row.phone_number as string | null) ?? null,
    role: String(row.role),
    permissions: Array.isArray(row.permissions) ? (row.permissions as string[]) : [],
    expiresAt: (row.expires_at as string | null) ?? null,
    acceptedAt: (row.accepted_at as string | null) ?? null,
  }));

  const config: AppConfigRecord | null = configResult.data[0]
    ? {
        id: String(configResult.data[0].id),
        alertThresholdP1Minutes: toNumber(configResult.data[0].alert_threshold_p1_minutes) ?? 30,
        alertThresholdP2Minutes: toNumber(configResult.data[0].alert_threshold_p2_minutes) ?? 120,
        alertThresholdP3Minutes: toNumber(configResult.data[0].alert_threshold_p3_minutes) ?? 480,
        dataRefreshMinutes: toNumber(configResult.data[0].data_refresh_minutes) ?? 30,
        autoEscalationEnabled: Boolean(configResult.data[0].auto_escalation_enabled),
        emailEnabled: Boolean(configResult.data[0].email_enabled),
        whatsappEnabled: Boolean(configResult.data[0].whatsapp_enabled),
        botApprovalProbeEnabled: Boolean(configResult.data[0].bot_approval_probe_enabled),
        updatedAt: (configResult.data[0].updated_at as string | null) ?? null,
      }
    : null;

  const onboardingGaps = buildOnboardingGaps(organization, tenantResult.data);

  return {
    organization,
    tenants: tenantResult.data,
    tasks,
    communications,
    documents,
    decisionDna,
    profiles,
    invites,
    config,
    onboardingGaps,
    warnings,
  };
}
