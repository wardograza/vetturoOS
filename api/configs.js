import { admin, readJsonBody, sendJson } from "./_lib/supabase.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { data, error } = await admin.from("app_configs").select("*").limit(1).maybeSingle();

      if (error) {
        throw error;
      }

      return sendJson(res, 200, { config: data });
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const { error } = await admin.from("app_configs").upsert({
        id: body.id || undefined,
        alert_threshold_p1_minutes: body.alertThresholdP1Minutes,
        alert_threshold_p2_minutes: body.alertThresholdP2Minutes,
        alert_threshold_p3_minutes: body.alertThresholdP3Minutes,
        data_refresh_minutes: body.dataRefreshMinutes,
        auto_escalation_enabled: body.autoEscalationEnabled,
        email_enabled: body.emailEnabled,
        whatsapp_enabled: body.whatsappEnabled,
        bot_approval_probe_enabled: body.botApprovalProbeEnabled,
      });

      if (error) {
        throw error;
      }

      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Config update failed.",
    });
  }
}
