import { chooseTaskAssignee } from "./task-routing.js";

function normalizeIsoDateTime(value) {
  if (!(typeof value === "string" && value.trim())) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function createTaskRecord({ admin, actorId, body }) {
  const title = String(body.title || "").trim();
  const department = String(body.department || "").trim().toLowerCase();
  const priority = String(body.priority || "P2").trim().toUpperCase();

  if (!title) {
    throw new Error("Please enter a task title before creating the task.");
  }

  if (!department) {
    throw new Error("Please choose a department so Vetturo knows where to route the task.");
  }

  let profiles = [];
  let assignee = null;

  let profilesResult = await admin
    .from("profiles")
    .select("id, full_name, role, permissions, is_active, availability_status, pto_from, pto_to");

  if (profilesResult.error) {
    profilesResult = await admin
      .from("profiles")
      .select("id, full_name, role, permissions, is_active");
  }

  if (!profilesResult.error) {
    profiles = profilesResult.data || [];
  }

  const tasksResult = await admin
    .from("tasks")
    .select("assigned_to, status")
    .in("status", ["open", "assigned", "in_progress", "awaiting_approval"]);

  if (profiles.length > 0) {
    assignee = chooseTaskAssignee({
      requestedAssigneeId: body.assignedToId || null,
      profiles,
      tasks: tasksResult.error ? [] : tasksResult.data || [],
      department,
    });
  }

  const normalizedSlaDueAt = normalizeIsoDateTime(body.slaDueAt);
  const basePayload = {
    title,
    description:
      typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
    department,
    priority,
    status: assignee ? "assigned" : "open",
    assigned_to: assignee?.id || null,
    proof_required: Boolean(body.proofRequired),
    sla_due_at: normalizedSlaDueAt,
    ...(actorId || body.createdBy ? { created_by: actorId || body.createdBy } : {}),
  };

  const payloadVariants = [
    basePayload,
    { ...basePayload, created_by: undefined },
    { ...basePayload, sla_due_at: null },
    { ...basePayload, assigned_to: null, status: "open" },
    {
      title,
      description: basePayload.description,
      department,
      priority,
      status: "open",
    },
    {
      title,
      department,
      status: "open",
    },
  ];

  let lastError = null;

  for (const variant of payloadVariants) {
    const sanitized = Object.fromEntries(
      Object.entries(variant).filter(([, value]) => value !== undefined),
    );

    const { error } = await admin.from("tasks").insert(sanitized);
    if (!error) {
      return {
        assignedToId: assignee?.id || null,
        assignedToName: assignee?.full_name || null,
        status: assignee ? "assigned" : "open",
        message: assignee
          ? `Task created and assigned to ${assignee.full_name || "the selected user"}.`
          : "Task created and added to the queue without an assignee.",
      };
    }

    lastError = error;
  }

  const detail =
    lastError && typeof lastError === "object"
      ? [lastError.message, lastError.details, lastError.hint].filter(Boolean).join(" ")
      : "";
  throw new Error(detail || "Task creation failed.");
}
