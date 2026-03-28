import { admin, readJsonBody, sendJson } from "./_lib/supabase.js";
import { findMissingFields, organizationRequiredFields, tenantRequiredFields } from "./_lib/workbook.js";

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function mapLegacyTenantRow(row, index) {
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

function mapTenantProfile(row) {
  const payload = row.source_payload || {};
  return {
    id: String(row.id),
    brandName: String(row.brand_name ?? payload.Brand_Name ?? "Unnamed Tenant"),
    unitCode: String(row.unit_code ?? payload.Unit_Code ?? "Unassigned"),
    rent: toNumber(row.rent_amount ?? row.mg_rent_monthly ?? payload.MG_Rent_Monthly) ?? 0,
    parentCompany: row.parent_company ?? payload.Parent_Company ?? null,
    categoryPrimary: row.category_primary ?? payload.Category_Primary ?? null,
    categorySecondary: row.category_secondary ?? payload.Category_Secondary ?? null,
    brandGrade: row.brand_grade ?? payload.Brand_Grade ?? null,
    brandPocName: row.brand_poc_name ?? payload.Brand_POC_Name ?? null,
    brandPocEmail: row.brand_poc_email ?? payload.Brand_POC_Email ?? null,
    storeManagerName: row.store_manager_name ?? payload.Store_Manager_Name ?? null,
    storeManagerPhone: row.store_manager_phone ?? payload.Store_Manager_Phone ?? null,
    billingContactEmail: row.billing_contact_email ?? payload.Billing_Contact_Email ?? null,
    nexusLeasingLead: row.nexus_leasing_lead ?? payload.Nexus_Leasing_Lead ?? null,
    leaseStartDate: row.lease_start_date ?? payload.Lease_Start_Date ?? null,
    leaseExpiryDate: row.lease_expiry_date ?? payload.Lease_Expiry_Date ?? null,
    mgRentMonthly: toNumber(row.mg_rent_monthly ?? payload.MG_Rent_Monthly),
    gtoPercent: toNumber(row.gto_percent ?? payload.GTO_Percent),
    securityDeposit: toNumber(row.security_deposit ?? payload.Security_Deposit),
    unitGlaSba: toNumber(row.unit_gla_sba ?? payload.Unit_GLA_SBA),
    powerLoadKva: toNumber(row.power_load_kva ?? payload.Power_Load_kVA),
    gasConnectionYn: row.gas_connection_yn ?? payload.Gas_Connection_YN ?? null,
    waterInletYn: row.water_inlet_yn ?? payload.Water_Inlet_YN ?? null,
    exhaustProvisionYn: row.exhaust_provision_yn ?? payload.Exhaust_Provision_YN ?? null,
    insuranceExpiry: row.insurance_expiry ?? payload.Insurance_Expiry ?? null,
    tradeLicenseExpiry: row.trade_license_expiry ?? payload.Trade_License_Expiry ?? null,
    lastAuditScore: toNumber(row.last_audit_score ?? payload.Last_Audit_Score),
    sourcePayload: payload,
  };
}

function buildOnboardingGaps(organization, tenants) {
  const gaps = [];
  if (!organization) {
    gaps.push({ scope: "organization", recordLabel: "Organization profile", missingFields: organizationRequiredFields });
  } else {
    const missing = findMissingFields(organization.sourcePayload || {}, organizationRequiredFields);
    if (missing.length > 0) gaps.push({ scope: "organization", recordLabel: organization.organizationName, missingFields: missing });
  }
  tenants.forEach((tenant) => {
    const missing = findMissingFields(tenant.sourcePayload || {}, tenantRequiredFields);
    if (missing.length > 0) gaps.push({ scope: "tenant", recordLabel: tenant.brandName, missingFields: missing });
  });
  return gaps;
}

async function fetchTasksForWorkspace() {
  const variants = [
    "id, title, description, department, priority, status, assigned_to, proof_required, sla_due_at, created_at",
    "id, title, description, department, priority, status, assigned_to, sla_due_at, created_at",
    "id, title, description, department, priority, status, assigned_to, created_at",
    "id, title, department, priority, status, assigned_to, created_at",
    "id, title, department, status, assigned_to",
    "id, title, status",
  ];

  for (const select of variants) {
    const result = await admin.from("tasks").select(select);
    if (!result.error) {
      return result;
    }
  }

  return { data: [], error: null };
}

async function fetchTaskEventsForWorkspace() {
  const variants = [
    "id, task_id, event_type, event_message, created_by, created_at, payload",
    "id, task_id, event_type, event_message, created_by, created_at",
    "id, task_id, event_type, event_message, created_at",
  ];

  for (const select of variants) {
    const result = await admin.from("task_events").select(select);
    if (!result.error) {
      return result;
    }
  }

  return { data: [], error: null };
}

export default async function handler(req, res) {
  try {
    if (req.method === "POST") {
      const body = await readJsonBody(req);
      if (body.action === "workspace") {
        const [
          organizationResult,
          tenantProfilesResult,
          legacyTenantsResult,
          communicationsResult,
          documentsResult,
          dnaResult,
          profilesResult,
          invitesResult,
          configResult,
        ] = await Promise.all([
          admin.from("organization_profiles").select("id, organization_name, organization_code, org_website_url, primary_brand_color, secondary_brand_color, portfolio_size_count, standard_hours_open, standard_hours_close, onboarding_lead_name, onboarding_lead_email, source_payload").limit(1),
          admin.from("tenant_profiles").select("id, brand_name, unit_code, rent_amount, parent_company, category_primary, category_secondary, brand_grade, brand_poc_name, brand_poc_email, store_manager_name, store_manager_phone, billing_contact_email, nexus_leasing_lead, lease_start_date, lease_expiry_date, mg_rent_monthly, gto_percent, security_deposit, unit_gla_sba, power_load_kva, gas_connection_yn, water_inlet_yn, exhaust_provision_yn, insurance_expiry, trade_license_expiry, last_audit_score, source_payload"),
          admin.from("tenants").select("tenant_name, unit_number, rent"),
          admin.from("communications").select("id, recipient_name, recipient_email, recipient_phone, channel, purpose, subject, body_preview, current_status, escalation_level, requires_action, sla_due_at, created_at"),
          admin.from("documents").select("id, file_name, storage_path, document_type, domain_category, sub_category, purpose_summary, status, parser_summary, is_in_core_memory, conflict_count, uploaded_at, source_payload"),
          admin.from("decision_dna_scores").select("id, candidate_brand_name, category, category_synergy, technical_fit, financial_health, cannibalization_risk, total_score, recommendation, research_summary, target_unit, replacement_brand, demand_signals, sources"),
          admin.from("profiles").select("id, email, full_name, username, role, phone_number, permissions, must_reset_password, is_active"),
          admin.from("user_invites").select("id, full_name, username, email, phone_number, role, permissions, expires_at, accepted_at"),
          admin.from("app_configs").select("id, alert_threshold_p1_minutes, alert_threshold_p2_minutes, alert_threshold_p3_minutes, data_refresh_minutes, auto_escalation_enabled, email_enabled, whatsapp_enabled, bot_approval_probe_enabled, updated_at"),
        ]);

        const [tasksResult, taskEventsResult] = await Promise.all([
          fetchTasksForWorkspace(),
          fetchTaskEventsForWorkspace(),
        ]);
        const eventsByTaskId = new Map();
        (taskEventsResult.data || []).forEach((event) => {
          const taskId = String(event.task_id || "");
          if (!taskId) return;
          const list = eventsByTaskId.get(taskId) || [];
          list.push({
            id: String(event.id),
            eventType: String(event.event_type || "event"),
            eventMessage: String(event.event_message || ""),
            createdBy: event.created_by ?? null,
            createdAt: event.created_at ?? null,
            payload: event.payload ?? null,
          });
          eventsByTaskId.set(taskId, list);
        });

        const organizationRow = organizationResult.data?.[0];
        const organization = organizationRow
          ? {
              id: String(organizationRow.id),
              organizationName: String(organizationRow.organization_name ?? organizationRow.source_payload?.Organization_Name ?? "Vetturo"),
              organizationCode: organizationRow.organization_code ?? organizationRow.source_payload?.Organization_Code ?? null,
              orgWebsiteUrl: organizationRow.org_website_url ?? organizationRow.source_payload?.Org_Website_URL ?? null,
              primaryBrandColor: organizationRow.primary_brand_color ?? organizationRow.source_payload?.Primary_Brand_Color ?? null,
              secondaryBrandColor: organizationRow.secondary_brand_color ?? organizationRow.source_payload?.Secondary_Brand_Color ?? null,
              portfolioSizeCount: toNumber(organizationRow.portfolio_size_count ?? organizationRow.source_payload?.Portfolio_Size_Count),
              standardHoursOpen: organizationRow.standard_hours_open ?? organizationRow.source_payload?.Standard_Hours_Open ?? null,
              standardHoursClose: organizationRow.standard_hours_close ?? organizationRow.source_payload?.Standard_Hours_Close ?? null,
              onboardingLeadName: organizationRow.onboarding_lead_name ?? organizationRow.source_payload?.Onboarding_Lead_Name ?? null,
              onboardingLeadEmail: organizationRow.onboarding_lead_email ?? organizationRow.source_payload?.Onboarding_Lead_Email ?? null,
              sourcePayload: organizationRow.source_payload || {},
            }
          : null;

        const tenants =
          tenantProfilesResult.data && tenantProfilesResult.data.length > 0
            ? tenantProfilesResult.data.map(mapTenantProfile)
            : (legacyTenantsResult.data || []).map(mapLegacyTenantRow);

        const singletonConfigRow =
          (configResult.data || []).find((row) => String(row.id) === "00000000-0000-0000-0000-000000000001") ||
          configResult.data?.[0];

        const profiles = (profilesResult.data || []).map((row) => ({
          id: String(row.id),
          email: String(row.email),
          fullName: String(row.full_name),
          username: row.username ?? null,
          role: String(row.role),
          phoneNumber: row.phone_number ?? null,
          permissions: Array.isArray(row.permissions) ? row.permissions : [],
          availabilityStatus: row.availability_status ?? null,
          ptoFrom: row.pto_from ?? null,
          ptoTo: row.pto_to ?? null,
          timezone: row.timezone ?? null,
          themePreference: row.theme_preference ?? null,
          mustResetPassword: Boolean(row.must_reset_password),
          isActive: Boolean(row.is_active),
        }));
        const profileNameById = new Map(profiles.map((profile) => [profile.id, profile.fullName]));

        return sendJson(res, 200, {
          organization,
          tenants,
          tasks: (tasksResult.data || []).map((row) => ({
            id: String(row.id),
            title: String(row.title),
            description: row.description ?? null,
            department: row.department ?? null,
            priority: row.priority ?? null,
            status: row.status ?? null,
            assignedToId: row.assigned_to ?? null,
            assignedToName: profileNameById.get(String(row.assigned_to ?? "")) ?? null,
            proofRequired: Boolean(row.proof_required),
            slaDueAt: row.sla_due_at ?? null,
            createdAt: row.created_at ?? null,
            eventLog: eventsByTaskId.get(String(row.id)) || [],
          })),
          communications: (communicationsResult.data || []).map((row) => ({
            id: String(row.id),
            recipientName: String(row.recipient_name),
            recipientEmail: row.recipient_email ?? null,
            recipientPhone: row.recipient_phone ?? null,
            channel: String(row.channel),
            purpose: String(row.purpose),
            subject: row.subject ?? null,
            bodyPreview: String(row.body_preview ?? ""),
            currentStatus: String(row.current_status),
            escalationLevel: toNumber(row.escalation_level) ?? 1,
            requiresAction: Boolean(row.requires_action),
            slaDueAt: row.sla_due_at ?? null,
            createdAt: row.created_at ?? null,
          })),
          documents: (documentsResult.data || []).map((row) => ({
            id: String(row.id),
            fileName: String(row.file_name),
            storagePath: String(row.storage_path),
            documentType: String(row.document_type),
            domainCategory: row.domain_category ?? null,
            subCategory: row.sub_category ?? null,
            purposeSummary: row.purpose_summary ?? null,
            status: String(row.status),
            parserSummary: row.parser_summary ?? null,
            isInCoreMemory: Boolean(row.is_in_core_memory),
            conflictCount: toNumber(row.conflict_count) ?? 0,
            uploadedAt: row.uploaded_at ?? null,
            sourcePayload: row.source_payload ?? null,
          })),
          decisionDna: (dnaResult.data || []).map((row) => ({
            id: String(row.id),
            candidateBrandName: String(row.candidate_brand_name),
            category: String(row.category),
            categorySynergy: toNumber(row.category_synergy) ?? 0,
            technicalFit: toNumber(row.technical_fit) ?? 0,
            financialHealth: toNumber(row.financial_health) ?? 0,
            cannibalizationRisk: toNumber(row.cannibalization_risk) ?? 0,
            totalScore: toNumber(row.total_score) ?? 0,
            recommendation: String(row.recommendation),
            researchSummary: row.research_summary ?? null,
            targetUnit: row.target_unit ?? null,
            replacementBrand: row.replacement_brand ?? null,
            demandSignals: Array.isArray(row.demand_signals) ? row.demand_signals : null,
            sources: Array.isArray(row.sources) ? row.sources : null,
          })),
          profiles,
          invites: (invitesResult.data || []).map((row) => ({
            id: String(row.id),
            fullName: String(row.full_name ?? ""),
            username: row.username ?? null,
            email: String(row.email),
            phoneNumber: row.phone_number ?? null,
            role: String(row.role),
            permissions: Array.isArray(row.permissions) ? row.permissions : [],
            expiresAt: row.expires_at ?? null,
            acceptedAt: row.accepted_at ?? null,
          })),
          config: singletonConfigRow
            ? {
                id: String(singletonConfigRow.id),
                alertThresholdP1Minutes: toNumber(singletonConfigRow.alert_threshold_p1_minutes) ?? 30,
                alertThresholdP2Minutes: toNumber(singletonConfigRow.alert_threshold_p2_minutes) ?? 120,
                alertThresholdP3Minutes: toNumber(singletonConfigRow.alert_threshold_p3_minutes) ?? 480,
                dataRefreshMinutes: toNumber(singletonConfigRow.data_refresh_minutes) ?? 30,
                autoEscalationEnabled: Boolean(singletonConfigRow.auto_escalation_enabled),
                emailEnabled: Boolean(singletonConfigRow.email_enabled),
                whatsappEnabled: Boolean(singletonConfigRow.whatsapp_enabled),
                botApprovalProbeEnabled: Boolean(singletonConfigRow.bot_approval_probe_enabled),
                updatedAt: singletonConfigRow.updated_at ?? null,
              }
            : null,
          onboardingGaps: buildOnboardingGaps(organization, tenants),
          warnings: [],
        });
      }
    }

    if (req.method !== "GET") {
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    await admin.from("app_configs").upsert({
      id: "00000000-0000-0000-0000-000000000001",
      updated_at: new Date().toISOString(),
    });

    return sendJson(res, 200, { ok: true, refreshedAt: new Date().toISOString() });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Refresh failed.",
    });
  }
}
