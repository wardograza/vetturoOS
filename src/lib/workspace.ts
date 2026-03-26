import { supabase } from "./supabase";
import type {
  CommunicationRecord,
  DecisionDnaRecord,
  DocumentRecord,
  InviteRecord,
  ProfileRecord,
  TaskRecord,
  Tenant,
  TenantRow,
  WorkspaceData,
} from "../types";

function mapTenantRow(row: TenantRow): Tenant {
  return {
    tenantName: row.tenant_name?.trim() || "Unnamed Tenant",
    unitNumber: row.unit_number?.trim() || "Unassigned",
    rent: typeof row.rent === "number" ? row.rent : 0,
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

export async function fetchWorkspaceData(): Promise<WorkspaceData> {
  const [tenantsResult, tasksResult, communicationsResult, documentsResult, dnaResult, profilesResult, invitesResult] =
    await Promise.all([
      safeSelect<TenantRow>("tenants", "tenant_name, unit_number, rent"),
      safeSelect<TaskRecord>(
        "tasks",
        "id, title, department, priority, status, proof_required, sla_due_at, created_at",
      ),
      safeSelect<CommunicationRecord>(
        "communications",
        "id, recipient_name, channel, purpose, subject, current_status, escalation_level, requires_action, sla_due_at, created_at",
      ),
      safeSelect<DocumentRecord>(
        "documents",
        "id, file_name, document_type, status, parser_summary, is_in_core_memory, uploaded_at",
      ),
      safeSelect<DecisionDnaRecord>(
        "decision_dna_scores",
        "id, candidate_brand_name, category, category_synergy, technical_fit, financial_health, cannibalization_risk, total_score, recommendation",
      ),
      safeSelect<ProfileRecord>(
        "profiles",
        "id, full_name, email, role, must_reset_password, is_active",
      ),
      safeSelect<InviteRecord>(
        "user_invites",
        "id, email, role, expires_at, accepted_at",
      ),
    ]);

  const warnings = [
    tenantsResult.warning,
    tasksResult.warning,
    communicationsResult.warning,
    documentsResult.warning,
    dnaResult.warning,
    profilesResult.warning,
    invitesResult.warning,
  ].filter((warning): warning is string => Boolean(warning));

  return {
    tenants: tenantsResult.data.map(mapTenantRow),
    tasks: tasksResult.data,
    communications: communicationsResult.data,
    documents: documentsResult.data,
    decisionDna: dnaResult.data,
    profiles: profilesResult.data,
    invites: invitesResult.data,
    warnings,
  };
}
