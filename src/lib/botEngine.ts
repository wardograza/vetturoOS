import type { CommunicationItem, CopilotMessage, PersonaId, TaskItem, VaultItem } from "../types";

export type NavPage =
  | "Dashboard"
  | "Tasks"
  | "Communications"
  | "Revenue"
  | "Leasing"
  | "Document Vault"
  | "Approvals"
  | "Permissions"
  | "Configs";

export interface BotRuntimeState {
  activePersona: PersonaId;
  activePage: NavPage;
  communications: CommunicationItem[];
  vaultItems: VaultItem[];
  tasksToday: TaskItem[];
}

export interface BotResolution {
  messages: CopilotMessage[];
  activePage?: NavPage;
  activePersona?: PersonaId;
  communications?: CommunicationItem[];
  vaultItems?: VaultItem[];
  tasksToday?: TaskItem[];
}

export const triggerTrackedCommunications = (
  communications: CommunicationItem[],
): CommunicationItem[] =>
  communications.map((item, index) => {
    if (index === 0 && (item.status === "Read" || item.status === "Opened")) {
      return {
        ...item,
        status: "Escalated",
        escalation: "Level 3 triggered",
        lastUpdated: "Just now",
        events: item.events.map((event) =>
          event.label === "Actioned" ? { ...event, at: "Escalation pending" } : event,
        ),
      };
    }

    if (item.status === "Delivered") {
      return {
        ...item,
        status: "Opened",
        escalation: "Level 2 in 24h",
        lastUpdated: "Just now",
        events: item.events.map((event) =>
          event.label === "Opened" ? { ...event, at: "Just now", complete: true } : event,
        ),
      };
    }

    return item;
  });

export const approveNextVaultItem = (vaultItems: VaultItem[]): VaultItem[] => {
  const nextPending = vaultItems.find((item) => item.status === "Pending Approval");
  if (!nextPending) {
    return vaultItems;
  }

  return vaultItems.map((item) =>
    item.id === nextPending.id ? { ...item, status: "Approved for Core Memory" } : item,
  );
};

export const createIncidentTask = (tasksToday: TaskItem[]): TaskItem[] => {
  const incident: TaskItem = {
    id: `task-${tasksToday.length + 1}`,
    title: "Escalate signage outage near west atrium",
    department: "Facilities",
    assignee: "Auto-assigned to Neha",
    status: "Assigned",
    proofRequired: true,
    slaDue: "Due in 90m",
  };

  return [incident, ...tasksToday];
};

export const resolveBotPrompt = (
  prompt: string,
  state: BotRuntimeState,
): BotResolution => {
  const normalized = prompt.toLowerCase();

  if (
    normalized.includes("revenue") ||
    normalized.includes("recover") ||
    normalized.includes("lease escalation")
  ) {
    return {
      activePage: "Revenue",
      activePersona: "finance",
      messages: [
        {
          role: "assistant",
          content:
            "Revenue recovery workflow initiated. Finance now has a lease-backed escalation pack, and the highest-value communication thread is visible with opened, read, and action tracking.",
        },
      ],
    };
  }

  if (
    normalized.includes("incident") ||
    normalized.includes("task") ||
    normalized.includes("assign")
  ) {
    return {
      activePage: "Tasks",
      tasksToday: createIncidentTask(state.tasksToday),
      messages: [
        {
          role: "assistant",
          content:
            "I created a new operational task, routed it to Facilities, and assigned it to the lowest-load eligible owner. Department-head review can happen next if needed.",
        },
      ],
    };
  }

  if (
    normalized.includes("approve") ||
    normalized.includes("vault") ||
    normalized.includes("memory") ||
    normalized.includes("document")
  ) {
    const updatedVault = approveNextVaultItem(state.vaultItems);
    const changed = updatedVault.some(
      (item, index) => item.status !== state.vaultItems[index]?.status,
    );

    return {
      activePage: "Document Vault",
      vaultItems: updatedVault,
      messages: [
        {
          role: "assistant",
          content: changed
            ? "I approved the next pending document for core memory. It can now be used as verified source material."
            : "The approval queue is clear. There are no pending memory items right now.",
        },
      ],
    };
  }

  if (
    normalized.includes("message") ||
    normalized.includes("email") ||
    normalized.includes("whatsapp") ||
    normalized.includes("communication") ||
    normalized.includes("escalate")
  ) {
    return {
      activePage: "Communications",
      communications: triggerTrackedCommunications(state.communications),
      messages: [
        {
          role: "assistant",
          content:
            "I advanced the tracked communications. The latest thread is now visible with opened, read, and escalation state so you can review before final action.",
        },
      ],
    };
  }

  if (
    normalized.includes("brand") ||
    normalized.includes("vet") ||
    normalized.includes("decision dna") ||
    normalized.includes("vacancy")
  ) {
    return {
      activePage: "Leasing",
      messages: [
        {
          role: "assistant",
          content:
            "I opened the leasing workspace and prepared the current Decision DNA shortlist so you can review fit, risk, and recommendation.",
        },
      ],
    };
  }

  if (
    normalized.includes("permission") ||
    normalized.includes("role") ||
    normalized.includes("invite")
  ) {
    return {
      activePage: "Permissions",
      messages: [
        {
          role: "assistant",
          content:
            "I opened the permissions workspace. For MVP, only Super Admins can invite users and manage top-level role access.",
        },
      ],
    };
  }

  if (
    normalized.includes("config") ||
    normalized.includes("setting") ||
    normalized.includes("provider")
  ) {
    return {
      activePage: "Configs",
      messages: [
        {
          role: "assistant",
          content:
            "I opened the configuration workspace for providers, SLA policy, and memory behavior.",
        },
      ],
    };
  }

  return {
    messages: [
      {
        role: "assistant",
        content:
          "I can help with revenue recovery, tracked communications, brand vetting, task creation, document approvals, permissions, or config review. Tell me the action you want me to take.",
      },
    ],
  };
};
