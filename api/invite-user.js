import { admin, buildTempPassword, readJsonBody, sendJson } from "./_lib/supabase.js";

async function sendInviteEmail({ email, fullName, username, tempPassword }) {
  const resendKey = process.env.RESEND_API_KEY;
  const appUrl = process.env.VITE_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "https://vetturo.ai";
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Vetturo <onboarding@resend.dev>";

  if (!resendKey) {
    throw new Error("RESEND_API_KEY is missing.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: "Your Vetturo access is ready",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <h2>Welcome to Vetturo</h2>
          <p>Hello ${fullName},</p>
          <p>Your Vetturo account has been created.</p>
          <p><strong>Username:</strong> ${username || email}</p>
          <p><strong>Temporary password:</strong> ${tempPassword}</p>
          <p>Login here: <a href="${appUrl}">${appUrl}</a></p>
          <p>You will be prompted to change your password on first login.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend error: ${text}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const body = await readJsonBody(req);
    const tempPassword = buildTempPassword();
    const permissions = Array.isArray(body.permissions) ? body.permissions : [];

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: body.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        username: body.username,
        full_name: body.fullName,
        phone_number: body.phoneNumber,
        role: body.role,
      },
    });

    if (authError) {
      throw authError;
    }

    const userId = authUser.user?.id;

    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      email: body.email,
      full_name: body.fullName,
      username: body.username,
      phone_number: body.phoneNumber,
      role: body.role,
      permissions,
      must_reset_password: true,
      is_active: true,
    });

    if (profileError) {
      throw profileError;
    }

    const { error: inviteError } = await admin.from("user_invites").insert({
      full_name: body.fullName,
      username: body.username,
      email: body.email,
      phone_number: body.phoneNumber,
      role: body.role,
      permissions,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    });

    if (inviteError) {
      throw inviteError;
    }

    await sendInviteEmail({
      email: body.email,
      fullName: body.fullName,
      username: body.username,
      tempPassword,
    });

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Invite flow failed.",
    });
  }
}
