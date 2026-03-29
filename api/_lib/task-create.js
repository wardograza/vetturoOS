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
    { payload: basePayload, keepsAssignment: Boolean(basePayload.assigned_to) },
    {
      payload: { ...basePayload, created_by: undefined },
      keepsAssignment: Boolean(basePayload.assigned_to),
    },
    {
      payload: { ...basePayload, sla_due_at: null },
      keepsAssignment: Boolean(basePayload.assigned_to),
    },
    {
      payload: { ...basePayload, assigned_to: null, status: "open" },
      keepsAssignment: false,
    },
    {
      payload: {
        title,
        description: basePayload.description,
        department,
        priority,
        status: "open",
      },
      keepsAssignment: false,
    },
    {
      payload: {
        title,
        department,
        status: "open",
      },
      keepsAssignment: false,
    },
  ];

  let lastError = null;

  for (const variant of payloadVariants) {
    const sanitized = Object.fromEntries(
      Object.entries(variant.payload).filter(([, value]) => value !== undefined),
    );

    const { error } = await admin.from("tasks").insert(sanitized);
    if (!error) {
      const createdTask = await admin
        .from("tasks")
        .select("id, assigned_to, status, sla_due_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const taskId = createdTask.data?.id || null;
      let finalAssignedToId = createdTask.data?.assigned_to || null;
      let finalStatus = createdTask.data?.status || "open";

      if (taskId && assignee && !finalAssignedToId && !variant.keepsAssignment) {
        const assignResult = await admin
          .from("tasks")
          .update({ assigned_to: assignee.id, status: "assigned" })
          .eq("id", taskId);

        if (!assignResult.error) {
          finalAssignedToId = assignee.id;
          finalStatus = "assigned";
        }
      }

      if (taskId) {
        await admin.from("task_events").insert({
          task_id: taskId,
          event_type: "created",
          event_message: finalAssignedToId
            ? `Task created and assigned to ${assignee.full_name || "the selected user"}.`
            : "Task created and left unassigned.",
          created_by: actorId || null,
          payload: {
            department,
            priority,
            assignedToId: finalAssignedToId,
            slaDueAt: normalizedSlaDueAt,
          },
        });
      }

      return {
        id: taskId,
        assignedToId: finalAssignedToId,
        assignedToName: finalAssignedToId ? assignee?.full_name || null : null,
        status: finalStatus,
        message: finalAssignedToId
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
