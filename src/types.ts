export type PersonaId =
  | "super_admin"
  | "mall_manager"
  | "leasing"
  | "finance"
  | "facilities";

export type Tone = "good" | "warn" | "neutral";

export type Severity = "P1" | "P2" | "P3";

export type TaskStatus =
  | "Open"
  | "Assigned"
  | "In Progress"
  | "Awaiting Approval"
  | "Awaiting Proof"
  | "Closed"
  | "Reopened";

export type CommunicationChannel = "Email" | "WhatsApp";

export type CommunicationStatus =
  | "Queued"
  | "Sending"
  | "Sent"
  | "Delivered"
  | "Opened"
  | "Read"
  | "Clicked"
  | "Replied"
  | "Actioned"
  | "Escalated"
  | "Bounced"
  | "Failed";

export type CommunicationPurpose =
  | "Lease Escalation"
  | "Budget Follow-up"
  | "Brand Outreach"
  | "Priority Escalation"
  | "Compliance Reminder"
  | "Approval Request";

export type MemoryStatus =
  | "Pending Parse"
  | "Pending Approval"
  | "Approved for Core Memory"
  | "Rejected"
  | "Requires Edit";

export interface Persona {
  id: PersonaId;
  label: string;
  title: string;
  focus: string;
  heroMetric: string;
  heroValue: string;
  summary: string;
}

export interface MetricCard {
  id: string;
  label: string;
  value: string;
  change: string;
  tone: Tone;
  detail: string;
}

export interface AlertItem {
  id: string;
  title: string;
  severity: Severity;
  owner: string;
  status: string;
  nextAction: string;
}

export interface TaskItem {
  id: string;
  title: string;
  department: string;
  assignee: string;
  status: TaskStatus;
  proofRequired: boolean;
  slaDue?: string;
}

export interface CommunicationEvent {
  label: CommunicationStatus;
  at: string;
  complete: boolean;
}

export interface CommunicationItem {
  id: string;
  recipient: string;
  channel: CommunicationChannel;
  purpose: CommunicationPurpose;
  status: CommunicationStatus;
  escalation: string;
  subject: string;
  requiresAction: boolean;
  sla: string;
  lastUpdated: string;
  events: CommunicationEvent[];
}

export interface BrandDecision {
  brand: string;
  suitability: number;
  categorySynergy: number;
  technicalFit: number;
  financialHealth: number;
  cannibalizationRisk: string;
  recommendation: string;
}

export interface VaultItem {
  id: string;
  name: string;
  type: "Lease" | "Budget";
  status: MemoryStatus;
  owner: string;
}

export interface CopilotMessage {
  role: "assistant" | "user";
  content: string;
}

export interface UserAccount {
  id: string;
  fullName: string;
  email: string;
  role: PersonaId;
  status: "Active" | "Invited" | "Inactive";
  mustResetPassword: boolean;
}

export interface InviteRecord {
  id: string;
  email: string;
  role: PersonaId;
  invitedBy: string;
  status: "Pending" | "Accepted" | "Expired";
  expiresAt: string;
}

export interface ConfigItem {
  id: string;
  label: string;
  description: string;
  value: string;
  status: "Configured" | "Pending" | "Mock";
}
