import { admin, getUserFromBearerToken, readJsonBody, sendJson } from "./_lib/supabase.js";
import { createTaskRecord } from "./_lib/task-create.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const user = await getUserFromBearerToken(req);
    const body = await readJsonBody(req);
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
