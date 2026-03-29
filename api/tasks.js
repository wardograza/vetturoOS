import { admin, getUserFromBearerToken, readJsonBody, sendJson } from "./_lib/supabase.js";
import { createTaskRecord } from "./_lib/task-create.js";

async function insertTaskEvent(payload) {
  const { error } = await admin.from("task_events").insert(payload);
  if (error) {
    return false;
  }

  return true;
}

async function updateTaskRecord(taskId, updates) {
  const variants = [
    updates,
    Object.fromEntries(Object.entries(updates).filter(([key]) => key !== "sla_due_at")),
    Object.fromEntries(Object.entries(updates).filter(([key]) => key !== "priority")),
    Object.fromEntries(
      Object.entries(updates).filter(([key]) => key !== "priority" && key !== "sla_due_at"),
    ),
  ].filter((variant) => Object.keys(variant).length > 0);

  let lastError = null;

  for (const variant of variants) {
    const { error } = await admin.from("tasks").update(variant).eq("id", taskId);
    if (!error) {
      return variant;
    }

    lastError = error;
  }

  throw lastError;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const user = await getUserFromBearerToken(req);
    const body = await readJsonBody(req);
    const isUpdateAction = body.action === "update_task";

    if (isUpdateAction) {
      if (!body.taskId) {
        return sendJson(res, 400, { error: "Task id is required to update a task." });
      }

      const updates = {};
      if (typeof body.status === "string" && body.status.trim()) {
        updates.status = body.status.trim();
      }
      if (typeof body.assignedToId === "string") {
        updates.assigned_to = body.assignedToId || null;
      }
      if (typeof body.priority === "string" && body.priority.trim()) {
        updates.priority = body.priority.trim().toUpperCase();
      }
      if (typeof body.slaDueAt === "string") {
        updates.sla_due_at = body.slaDueAt ? new Date(body.slaDueAt).toISOString() : null;
      }

      if (Object.keys(updates).length > 0) {
        const appliedUpdates = await updateTaskRecord(body.taskId, updates);
        await insertTaskEvent({
          task_id: body.taskId,
          event_type: "updated",
          event_message: "Task details updated.",
          created_by: user?.id || null,
          payload: appliedUpdates,
        });
      }

      if (typeof body.comment === "string" && body.comment.trim()) {
        await insertTaskEvent({
          task_id: body.taskId,
          event_type: "comment",
          event_message: body.comment.trim(),
          created_by: user?.id || null,
          payload: null,
        });
      }

      return sendJson(res, 200, { ok: true });
    }

    if (body.action === "delete_task") {
      if (!body.taskId) {
        return sendJson(res, 400, { error: "Task id is required to delete a task." });
      }

      const { error } = await admin.from("tasks").delete().eq("id", body.taskId);
      if (error) {
        throw error;
      }

      return sendJson(res, 200, { ok: true });
    }

    const result = await createTaskRecord({
      admin,
      actorId: user?.id || null,
      body,
    });

    return sendJson(res, 200, {
      ok: true,
      ...result,
    });
  } catch (error) {
    return sendJson(res, 500, {
      error:
        error instanceof Error
          ? error.message
          : "Task request failed.",
    });
  }
}
