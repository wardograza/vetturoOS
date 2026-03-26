import { admin, getUserFromBearerToken, readJsonBody, sendJson } from "./_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const user = await getUserFromBearerToken(req);
    if (!user) {
      return sendJson(res, 401, { error: "Unauthorized." });
    }

    const body = await readJsonBody(req);
    const profileUpdates = {};

    if (typeof body.fullName === "string") {
      profileUpdates.full_name = body.fullName;
    }

    if (typeof body.username === "string") {
      profileUpdates.username = body.username;
    }

    if (typeof body.phoneNumber === "string") {
      profileUpdates.phone_number = body.phoneNumber;
    }

    if (typeof body.mustResetPassword === "boolean") {
      profileUpdates.must_reset_password = body.mustResetPassword;
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error } = await admin.from("profiles").update(profileUpdates).eq("id", user.id);
      if (error) {
        throw error;
      }
    }

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Profile update failed.",
    });
  }
}
