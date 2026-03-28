import { admin, getUserFromBearerToken, readJsonBody, sendJson } from "./_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const body = await readJsonBody(req);

    if (body.action === "lookup_username") {
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
    }

    const user = await getUserFromBearerToken(req);
    if (!user) {
      return sendJson(res, 401, { error: "Unauthorized." });
    }
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
