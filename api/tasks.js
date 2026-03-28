import { admin, getUserFromBearerToken, readJsonBody, sendJson } from "./_lib/supabase.js";
import { chooseTaskAssignee } from "./_lib/task-routing.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const user = await getUserFromBearerToken(req);
    const body = await readJsonBody(req);
    const title = String(body.title || "").trim();
    const department = String(body.department || "").trim().toLowerCase();
    const priority = String(body.priority || "P2").trim().toUpperCase();

    if (!title) {
      return sendJson(res, 400, { error: "Please enter a task title before creating the task." });
    }

    if (!department) {
      return sendJson(res, 400, { error: "Please choose a department so Vetturo knows where to route the task." });
    }

    let profilesResult = await admin
      .from("profiles")
      .select("id, full_name, role, permissions, is_active, availability_status, pto_from, pto_to");

    if (profilesResult.error) {
      profilesResult = await admin
        .from("profiles")
        .select("id, full_name, role, permissions, is_active");
    }

    const tasksResult = await admin
      .from("tasks")
      .select("assigned_to, status")
      .in("status", ["open", "assigned", "in_progress", "awaiting_approval"]);

    if (profilesResult.error) {
      throw profilesResult.error;
    }

    if (tasksResult.error) {
      throw tasksResult.error;
    }

    const assignee = chooseTaskAssignee({
      requestedAssigneeId: body.assignedToId || null,
      profiles: profilesResult.data || [],
      tasks: tasksResult.data || [],
      department,
    });

    const normalizedSlaDueAt = (() => {
      if (!(typeof body.slaDueAt === "string" && body.slaDueAt.trim())) {
        return null;
      }

      const parsed = new Date(body.slaDueAt);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    })();

    const basePayload = {
      title,
      description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
      department,
      priority,
      status: assignee ? "assigned" : "open",
      assigned_to: assignee?.id || null,
      proof_required: Boolean(body.proofRequired),
      sla_due_at: normalizedSlaDueAt,
      ...(user?.id || body.createdBy ? { created_by: user?.id || body.createdBy } : {}),
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
    ];

    let insertedRow = null;
    let lastError = null;

    for (const variant of payloadVariants) {
      const sanitized = Object.fromEntries(
        Object.entries(variant).filter(([, value]) => value !== undefined),
      );

      const { data, error } = await admin.from("tasks").insert(sanitized).select("id").single();
      if (!error && data) {
        insertedRow = data;
        lastError = null;
        break;
      }

      lastError = error;
    }

    if (!insertedRow) {
      const detail =
        lastError && typeof lastError === "object"
          ? [lastError.message, lastError.details, lastError.hint].filter(Boolean).join(" ")
          : "";
      throw new Error(detail || "Task creation failed.");
    }

    return sendJson(res, 200, {
      ok: true,
      id: insertedRow.id,
      assignedToId: assignee?.id || null,
      assignedToName: assignee?.full_name || null,
      status: assignee ? "assigned" : "open",
      message: assignee
        ? `Task created and assigned to ${assignee.full_name || "the selected user"}.`
        : "Task created and added to the queue without an assignee.",
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Task creation failed.",
    });
  }
}
