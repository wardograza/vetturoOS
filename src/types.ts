export type NavPage =
  | "Overview"
  | "Tenants"
  | "Revenue"
  | "Tasks"
  | "Communications"
  | "Document Vault"
  | "Leasing"
  | "Approvals"
  | "Permissions"
  | "Configs";

export interface TenantRow {
  tenant_name: string | null;
  unit_number: string | null;
  rent: number | null;
}

export interface Tenant {
  tenantName: string;
  unitNumber: string;
  rent: number;
}

export interface TaskRecord {
  id: string;
  title: string;
  department: string | null;
  priority: string | null;
  status: string | null;
  proof_required: boolean | null;
  sla_due_at: string | null;
  created_at: string | null;
}

export interface CommunicationRecord {
  id: string;
  recipient_name: string;
  channel: string;
  purpose: string;
  subject: string | null;
  current_status: string;
  escalation_level: number;
  requires_action: boolean;
  sla_due_at: string | null;
  created_at: string | null;
}

export interface DocumentRecord {
  id: string;
  file_name: string;
  document_type: string;
  status: string;
  parser_summary: string | null;
  is_in_core_memory: boolean;
  uploaded_at: string | null;
}

export interface DecisionDnaRecord {
  id: string;
  candidate_brand_name: string;
  category: string;
  category_synergy: number;
  technical_fit: number;
  financial_health: number;
  cannibalization_risk: number;
  total_score: number;
  recommendation: string;
}

export interface ProfileRecord {
  id: string;
  full_name: string;
  email: string;
  role: string;
  must_reset_password: boolean;
  is_active: boolean;
}

export interface InviteRecord {
  id: string;
  email: string;
  role: string;
  expires_at: string | null;
  accepted_at: string | null;
}

export interface WorkspaceData {
  tenants: Tenant[];
  tasks: TaskRecord[];
  communications: CommunicationRecord[];
  documents: DocumentRecord[];
  decisionDna: DecisionDnaRecord[];
  profiles: ProfileRecord[];
  invites: InviteRecord[];
  warnings: string[];
}
