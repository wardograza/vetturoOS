import { admin, sendJson } from "./_lib/supabase.js";

export default async function handler(_req, res) {
  try {
    await admin.from("app_configs").upsert({
      id: "00000000-0000-0000-0000-000000000001",
      updated_at: new Date().toISOString(),
    });

    return sendJson(res, 200, { ok: true, refreshedAt: new Date().toISOString() });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Refresh failed.",
    });
  }
}
