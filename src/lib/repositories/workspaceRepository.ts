import {
  communications,
  configItems,
  copilotMessages,
  inviteRecords,
  tasksToday,
  userAccounts,
  vaultItems,
} from "../../data";
import type {
  CommunicationItem,
  ConfigItem,
  CopilotMessage,
  InviteRecord,
  TaskItem,
  UserAccount,
  VaultItem,
} from "../../types";
import {
  approveNextVaultItem,
  createIncidentTask,
  triggerTrackedCommunications,
} from "../botEngine";

export interface WorkspaceSnapshot {
  communications: CommunicationItem[];
  vaultItems: VaultItem[];
  tasksToday: TaskItem[];
  chatMessages: CopilotMessage[];
  userAccounts: UserAccount[];
  inviteRecords: InviteRecord[];
  configItems: ConfigItem[];
}

export interface WorkspaceRepository {
  loadSnapshot(): Promise<WorkspaceSnapshot>;
  advanceCommunications(current: CommunicationItem[]): Promise<CommunicationItem[]>;
  approveNextVaultItem(current: VaultItem[]): Promise<VaultItem[]>;
  createIncident(current: TaskItem[]): Promise<TaskItem[]>;
  createInvite(current: InviteRecord[]): Promise<InviteRecord[]>;
}

export const mockWorkspaceRepository: WorkspaceRepository = {
  async loadSnapshot() {
    return {
      communications,
      vaultItems,
      tasksToday,
      chatMessages: copilotMessages,
      userAccounts,
      inviteRecords,
      configItems,
    };
  },
  async advanceCommunications(current) {
    return triggerTrackedCommunications(current);
  },
  async approveNextVaultItem(current) {
    return approveNextVaultItem(current);
  },
  async createIncident(current) {
    return createIncidentTask(current);
  },
  async createInvite(current) {
    const nextInvite: InviteRecord = {
      id: `invite-${current.length + 1}`,
      email: "ops-lead@nexuskoramangala.com",
      role: "facilities",
      invitedBy: "Ananya Rao",
      status: "Pending",
      expiresAt: "30 Mar 2026",
    };
    return [nextInvite, ...current];
  },
};
