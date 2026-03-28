import { admin, getUserFromBearerToken, readJsonBody, sendJson } from "./_lib/supabase.js";
import { createTaskRecord } from "./_lib/task-create.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const user = await getUserFromBearerToken(req);
    const body = await readJsonBody(req);

     if (body.action === "update_task") {
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
        const { error } = await admin.from("tasks").update(updates).eq("id", body.taskId);
        if (error) {
          throw error;
        }

        await admin.from("task_events").insert({
          task_id: body.taskId,
          event_type: "updated",
          event_message: "Task details updated.",
          created_by: user?.id || null,
          payload: updates,
        });
      }

      if (typeof body.comment === "string" && body.comment.trim()) {
        await admin.from("task_events").insert({
          task_id: body.taskId,
          event_type: "comment",
          event_message: body.comment.trim(),
          created_by: user?.id || null,
          payload: null,
        });
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
      error: error instanceof Error ? error.message : "Task creation failed.",
    });
  }
}
