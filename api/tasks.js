import { admin, getUserFromBearerToken, readJsonBody, sendJson } from "./_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const user = await getUserFromBearerToken(req);
    const body = await readJsonBody(req);
    const basePayload = {
      title: body.title,
      description: body.description,
      department: body.department,
      priority: body.priority,
      status: "open",
      assigned_to: body.assignedToId || null,
      proof_required: Boolean(body.proofRequired),
      sla_due_at: body.slaDueAt || null,
    };

    const payloadVariants = [
      {
        ...basePayload,
        ...(user?.id || body.createdBy ? { created_by: user?.id || body.createdBy } : {}),
      },
      basePayload,
      {
        title: body.title,
        description: body.description || null,
        department: body.department || null,
        priority: body.priority || "P2",
        status: "open",
      },
      {
        title: body.title,
        status: "open",
      },
    ];

    let data = null;
    let lastError = null;

    for (const payload of payloadVariants) {
      const result = await admin.from("tasks").insert(payload).select("id").single();
      if (!result.error) {
        data = result.data;
        lastError = null;
        break;
      }

      lastError = result.error;
    }

    if (lastError || !data) {
      throw lastError ?? new Error("Task creation failed.");
    }

    return sendJson(res, 200, { ok: true, id: data.id });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Task creation failed.",
    });
  }
}
