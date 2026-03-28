export type NavPage =
  | "Overview"
  | "Profile"
  | "Tenants"
  | "Revenue"
  | "Tasks"
  | "Communications"
  | "Document Vault"
  | "Leasing Intel"
  | "Approvals"
  | "Invite User"
  | "Configs";

export interface AuthProfile {
  id: string;
  email: string;
  fullName: string;
  username: string | null;
  role: string;
  phoneNumber: string | null;
  permissions: string[];
  availabilityStatus: string | null;
  ptoFrom: string | null;
  ptoTo: string | null;
  timezone: string | null;
  themePreference: string | null;
  mustResetPassword: boolean;
  isActive: boolean;
}

export interface TenantRow {
  tenant_name: string | null;
  unit_number: string | null;
  rent: number | null;
}

export interface OrganizationProfile {
  id: string;
  organizationName: string;
  organizationCode: string | null;
  orgWebsiteUrl: string | null;
  primaryBrandColor: string | null;
  secondaryBrandColor: string | null;
  portfolioSizeCount: number | null;
  standardHoursOpen: string | null;
  standardHoursClose: string | null;
  onboardingLeadName: string | null;
  onboardingLeadEmail: string | null;
  sourcePayload: Record<string, string | number | boolean | null>;
}

export interface TenantProfile {
  id: string;
  brandName: string;
  unitCode: string;
  rent: number;
  parentCompany: string | null;
  categoryPrimary: string | null;
  categorySecondary: string | null;
  brandGrade: string | null;
  brandPocName: string | null;
  brandPocEmail: string | null;
  storeManagerName: string | null;
  storeManagerPhone: string | null;
  billingContactEmail: string | null;
  nexusLeasingLead: string | null;
  leaseStartDate: string | null;
  leaseExpiryDate: string | null;
  mgRentMonthly: number | null;
  gtoPercent: number | null;
  securityDeposit: number | null;
  unitGlaSba: number | null;
  powerLoadKva: number | null;
  gasConnectionYn: string | null;
  waterInletYn: string | null;
  exhaustProvisionYn: string | null;
  insuranceExpiry: string | null;
  tradeLicenseExpiry: string | null;
  lastAuditScore: number | null;
  sourcePayload: Record<string, string | number | boolean | null>;
}

export interface TaskRecord {
  id: string;
  title: string;
  description: string | null;
  department: string | null;
  priority: string | null;
  status: string | null;
  assignedToName: string | null;
  assignedToId: string | null;
  proofRequired: boolean;
  slaDueAt: string | null;
  createdAt: string | null;
  eventLog: TaskEventRecord[];
}

export interface TaskEventRecord {
  id: string;
  eventType: string;
  eventMessage: string;
  createdBy: string | null;
  createdAt: string | null;
  payload: Record<string, unknown> | null;
}

export interface CommunicationRecord {
  id: string;
  recipientName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  channel: string;
  purpose: string;
  subject: string | null;
  bodyPreview: string;
  currentStatus: string;
  escalationLevel: number;
  requiresAction: boolean;
  slaDueAt: string | null;
  createdAt: string | null;
}

export interface DocumentRecord {
  id: string;
  fileName: string;
  storagePath: string;
  documentType: string;
  domainCategory: string | null;
  subCategory: string | null;
  purposeSummary: string | null;
  status: string;
  parserSummary: string | null;
  isInCoreMemory: boolean;
  conflictCount: number;
  uploadedAt: string | null;
  sourcePayload: Record<string, unknown> | null;
}

export interface DecisionDnaRecord {
  id: string;
  candidateBrandName: string;
  category: string;
  categorySynergy: number;
  technicalFit: number;
  financialHealth: number;
  cannibalizationRisk: number;
  totalScore: number;
  recommendation: string;
  researchSummary?: string | null;
  targetUnit?: string | null;
  replacementBrand?: string | null;
  demandSignals?: string[] | null;
  sources?: string[] | null;
}

export interface InviteRecord {
  id: string;
  fullName: string;
  username: string | null;
  email: string;
  phoneNumber: string | null;
  role: string;
  permissions: string[];
  expiresAt: string | null;
  acceptedAt: string | null;
}

export interface AppConfigRecord {
  id: string;
  alertThresholdP1Minutes: number;
  alertThresholdP2Minutes: number;
  alertThresholdP3Minutes: number;
  dataRefreshMinutes: number;
  autoEscalationEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  botApprovalProbeEnabled: boolean;
  updatedAt: string | null;
}

export interface OnboardingGap {
  scope: "organization" | "tenant";
  recordLabel: string;
  missingFields: string[];
}

export interface WorkspaceData {
  organization: OrganizationProfile | null;
  tenants: TenantProfile[];
  tasks: TaskRecord[];
  communications: CommunicationRecord[];
  documents: DocumentRecord[];
  decisionDna: DecisionDnaRecord[];
  profiles: AuthProfile[];
  invites: InviteRecord[];
  config: AppConfigRecord | null;
  onboardingGaps: OnboardingGap[];
  warnings: string[];
}

export interface WorkbookField {
  key: string;
  label: string;
  description: string;
  required?: boolean;
}

export interface WorkbookSection {
  title: string;
  scope: "organization" | "tenant";
  fields: WorkbookField[];
}
