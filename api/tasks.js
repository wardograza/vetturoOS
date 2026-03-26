import { admin, getUserFromBearerToken, readJsonBody, sendJson } from "./_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const user = await getUserFromBearerToken(req);
    const body = await readJsonBody(req);
    const payload = {
      title: body.title,
      description: body.description,
      department: body.department,
      priority: body.priority,
      status: "open",
      assigned_to: body.assignedToId || null,
      proof_required: Boolean(body.proofRequired),
      sla_due_at: body.slaDueAt || null,
    };

    if (user?.id || body.createdBy) {
      payload.created_by = user?.id || body.createdBy;
    }

    const { data, error } = await admin
      .from("tasks")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return sendJson(res, 200, { ok: true, id: data.id });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Task creation failed.",
    });
  }
}
