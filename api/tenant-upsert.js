import { admin, readJsonBody, sendJson } from "./_lib/supabase.js";

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const body = await readJsonBody(req);
    const payload = body.payload || {};

    const { error } = await admin.from("tenant_profiles").upsert({
      brand_name: payload.Brand_Name,
      unit_code: payload.Unit_Code,
      rent_amount: numberOrNull(payload.MG_Rent_Monthly),
      parent_company: payload.Parent_Company || null,
      category_primary: payload.Category_Primary || null,
      category_secondary: payload.Category_Secondary || null,
      brand_grade: payload.Brand_Grade || null,
      brand_poc_name: payload.Brand_POC_Name || null,
      brand_poc_email: payload.Brand_POC_Email || null,
      store_manager_name: payload.Store_Manager_Name || null,
      store_manager_phone: payload.Store_Manager_Phone || null,
      billing_contact_email: payload.Billing_Contact_Email || null,
      nexus_leasing_lead: payload.Nexus_Leasing_Lead || null,
      lease_start_date: payload.Lease_Start_Date || null,
      lease_expiry_date: payload.Lease_Expiry_Date || null,
      mg_rent_monthly: numberOrNull(payload.MG_Rent_Monthly),
      gto_percent: numberOrNull(payload.GTO_Percent),
      security_deposit: numberOrNull(payload.Security_Deposit),
      unit_gla_sba: numberOrNull(payload.Unit_GLA_SBA),
      power_load_kva: numberOrNull(payload.Power_Load_kVA),
      gas_connection_yn: payload.Gas_Connection_YN || null,
      water_inlet_yn: payload.Water_Inlet_YN || null,
      exhaust_provision_yn: payload.Exhaust_Provision_YN || null,
      insurance_expiry: payload.Insurance_Expiry || null,
      trade_license_expiry: payload.Trade_License_Expiry || null,
      last_audit_score: numberOrNull(payload.Last_Audit_Score),
      source_payload: payload,
    });

    if (error) {
      throw error;
    }

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Tenant upsert failed.",
    });
  }
}
