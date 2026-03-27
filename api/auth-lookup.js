import { admin, readJsonBody, sendJson } from "./_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();

    if (!username) {
      return sendJson(res, 400, { error: "Username is required." });
    }

    const { data, error } = await admin.from("profiles").select("email").eq("username", username).limit(1).maybeSingle();

    if (error) {
      throw error;
    }

    if (!data?.email) {
      return sendJson(res, 404, { error: "Username not found." });
    }

    return sendJson(res, 200, { email: data.email });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Username lookup failed.",
    });
  }
}
