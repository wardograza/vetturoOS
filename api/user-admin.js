import { admin, buildTempPassword, getUserFromBearerToken, readJsonBody, sendJson } from "./_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const actor = await getUserFromBearerToken(req);
    if (!actor) {
      return sendJson(res, 401, { error: "Unauthorized." });
    }

    const body = await readJsonBody(req);

    if (body.action === "reset_password") {
      const tempPassword = buildTempPassword();
      const { error } = await admin.auth.admin.updateUserById(body.userId, {
        password: tempPassword,
      });

      if (error) {
        throw error;
      }

      await admin.from("profiles").update({ must_reset_password: true }).eq("id", body.userId);
      return sendJson(res, 200, { ok: true, tempPassword });
    }

    if (body.action === "delete_user") {
      const { error: profileError } = await admin.from("profiles").delete().eq("id", body.userId);
      if (profileError) {
        throw profileError;
      }

      await admin.from("user_invites").delete().eq("email", body.email);
      const { error } = await admin.auth.admin.deleteUser(body.userId);
      if (error) {
        throw error;
      }

      return sendJson(res, 200, { ok: true });
    }

    if (body.action === "update_user") {
      const { error } = await admin
        .from("profiles")
        .update({
          full_name: body.fullName,
          username: body.username,
          phone_number: body.phoneNumber,
          role: body.role,
          permissions: Array.isArray(body.permissions) ? body.permissions : [],
        })
        .eq("id", body.userId);

      if (error) {
        throw error;
      }

      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 400, { error: "Unsupported action." });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "User admin action failed.",
    });
  }
}
