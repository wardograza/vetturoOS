import { useEffect, useMemo, useState } from "react";
import { mockWorkspaceRepository } from "../lib/repositories/workspaceRepository";
import type {
  CommunicationItem,
  ConfigItem,
  CopilotMessage,
  InviteRecord,
  TaskItem,
  UserAccount,
  VaultItem,
} from "../types";

export function useWorkspaceController() {
  const repository = mockWorkspaceRepository;
  const [communications, setCommunications] = useState<CommunicationItem[]>([]);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [tasksToday, setTasksToday] = useState<TaskItem[]>([]);
  const [chatMessages, setChatMessages] = useState<CopilotMessage[]>([]);
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
  const [inviteRecords, setInviteRecords] = useState<InviteRecord[]>([]);
  const [configItems, setConfigItems] = useState<ConfigItem[]>([]);

  useEffect(() => {
    let active = true;
    repository.loadSnapshot().then((snapshot) => {
      if (!active) return;
      setCommunications(snapshot.communications);
      setVaultItems(snapshot.vaultItems);
      setTasksToday(snapshot.tasksToday);
      setChatMessages(snapshot.chatMessages);
      setUserAccounts(snapshot.userAccounts);
      setInviteRecords(snapshot.inviteRecords);
      setConfigItems(snapshot.configItems);
    });
    return () => {
      active = false;
    };
  }, [repository]);

  const actions = useMemo(
    () => ({
      async advanceCommunications() {
        const updated = await repository.advanceCommunications(communications);
        setCommunications(updated);
        return updated;
      },
      async approveNextVaultItem() {
        const updated = await repository.approveNextVaultItem(vaultItems);
        setVaultItems(updated);
        return updated;
      },
      async createIncident() {
        const updated = await repository.createIncident(tasksToday);
        setTasksToday(updated);
        return updated;
      },
      async createInvite() {
        const updated = await repository.createInvite(inviteRecords);
        setInviteRecords(updated);
        return updated;
      },
      appendMessages(messages: CopilotMessage[]) {
        setChatMessages((current) => [...current, ...messages]);
      },
      appendUserMessage(content: string) {
        setChatMessages((current) => [...current, { role: "user", content }]);
      },
    }),
    [communications, inviteRecords, repository, tasksToday, vaultItems],
  );

  return {
    communications,
    vaultItems,
    tasksToday,
    chatMessages,
    userAccounts,
    inviteRecords,
    configItems,
    actions,
  };
}
