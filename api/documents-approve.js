import { admin, readJsonBody, sendJson } from "./_lib/supabase.js";
import { findMissingFields, organizationRequiredFields, tenantRequiredFields } from "./_lib/workbook.js";

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function conflictEntries(existing, incoming) {
  if (!existing) {
    return [];
  }

  return Object.entries(incoming).filter(([key, value]) => {
    const current = existing[key];
    return current !== undefined && current !== null && String(current) !== String(value);
  });
}

function mapRentRollRowToTenantPayload(row) {
  return {
    Brand_Name: row["Brand Name"] || row["Customer Name"] || "",
    Parent_Company: row["Group/Parent Name"] || row["Company Name"] || "",
    Category_Primary: row["Sales Category"] || row["Category"] || "",
    Category_Secondary: row["Sales Sub Category"] || "",
    Unit_Code: row["Unit No"] || row.Unit || "",
    Lease_Start_Date: row["Original Lease start date"] || row["Start Date"] || "",
    Lease_Expiry_Date: row["Ultimate Lease Expiry date"] || row["Original Lease End Date"] || row["End Date"] || "",
    MG_Rent_Monthly: row["Current MG (Per Month)"] || row["Escalated /New Rent"] || row["Current Rent"] || row["Rent"] || "",
    GTO_Percent: row["%Rev share  - 1"] || row["New RS%"] || row["RS%"] || "",
    Security_Deposit: row["Total Deposit Amount (Received till Asofdate)"] || "",
    Unit_GLA_SBA: row.GLA || row.SBA || row["Chargable Area"] || "",
    Power_Load_kVA: row["Power_Load_kVA"] || "",
    Gas_Connection_YN: row["Gas_Connection_YN"] || "",
    Water_Inlet_YN: row["Water_Inlet_YN"] || "",
    Exhaust_Provision_YN: row["Exhaust_Provision_YN"] || "",
    Insurance_Expiry: row["Insurance_Expiry"] || "",
    Trade_License_Expiry: row["Trade_License_Expiry"] || "",
    Last_Audit_Score: row["Health Ratio"] || "",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const body = await readJsonBody(req);
    const { data: document, error: documentError } = await admin
      .from("documents")
      .select("*")
      .eq("id", body.documentId)
      .single();

    if (documentError) {
      throw documentError;
    }

    const payload = document.source_payload || {};
    const organizationPayload = payload.organizationPayload || null;
    const tenantPayloads = Array.isArray(payload.tenantPayloads) ? payload.tenantPayloads : null;
    const rentRollRows = Array.isArray(payload.rentRollRows) ? payload.rentRollRows : null;
    const financeSummaryRows = Array.isArray(payload.financeSummaryRows) ? payload.financeSummaryRows : null;
    const brandStatsRows = Array.isArray(payload.brandStatsRows) ? payload.brandStatsRows : null;
    let conflicts = [];

    if (organizationPayload || tenantPayloads) {
      if (organizationPayload) {
        const { data: existingOrg } = await admin
          .from("organization_profiles")
          .select("source_payload")
          .limit(1)
          .maybeSingle();

        conflicts = conflicts.concat(conflictEntries(existingOrg?.source_payload, organizationPayload));

        if (conflicts.length > 0 && !body.allowOverwrite) {
          return sendJson(res, 200, {
            requiresConfirmation: true,
            conflicts,
          });
        }

        const missing = findMissingFields(organizationPayload, organizationRequiredFields);

        await admin.from("organization_profiles").upsert({
          organization_name: organizationPayload.Organization_Name || "Vetturo",
          organization_code: organizationPayload.Organization_Code || null,
          org_website_url: organizationPayload.Org_Website_URL || null,
          primary_brand_color: organizationPayload.Primary_Brand_Color || null,
          secondary_brand_color: organizationPayload.Secondary_Brand_Color || null,
          portfolio_size_count: numberOrNull(organizationPayload.Portfolio_Size_Count),
          standard_hours_open: organizationPayload.Standard_Hours_Open || null,
          standard_hours_close: organizationPayload.Standard_Hours_Close || null,
          onboarding_lead_name: organizationPayload.Onboarding_Lead_Name || null,
          onboarding_lead_email: organizationPayload.Onboarding_Lead_Email || null,
          source_payload: organizationPayload,
        });

        await admin.from("document_memory_entries").insert({
          document_id: document.id,
          kind: "structured_fields",
          title: organizationPayload.Organization_Name || "Organization onboarding",
          structured_payload: {
            missingFields: missing,
            sourcePayload: organizationPayload,
          },
        });
      }

      if (tenantPayloads) {
        for (const tenantPayload of tenantPayloads) {
          const { data: existingTenant } = await admin
            .from("tenant_profiles")
            .select("brand_name, unit_code, source_payload")
            .eq("brand_name", tenantPayload.Brand_Name)
            .maybeSingle();

          conflicts = conflicts.concat(conflictEntries(existingTenant?.source_payload, tenantPayload));
        }

        if (conflicts.length > 0 && !body.allowOverwrite) {
          return sendJson(res, 200, {
            requiresConfirmation: true,
            conflicts,
          });
        }

        for (const tenantPayload of tenantPayloads) {
          const missing = findMissingFields(tenantPayload, tenantRequiredFields);

          await admin.from("tenant_profiles").upsert({
            brand_name: tenantPayload.Brand_Name,
            unit_code: tenantPayload.Unit_Code,
            rent_amount: numberOrNull(tenantPayload.MG_Rent_Monthly),
            parent_company: tenantPayload.Parent_Company || null,
            category_primary: tenantPayload.Category_Primary || null,
            category_secondary: tenantPayload.Category_Secondary || null,
            brand_grade: tenantPayload.Brand_Grade || null,
            brand_poc_name: tenantPayload.Brand_POC_Name || null,
            brand_poc_email: tenantPayload.Brand_POC_Email || null,
            store_manager_name: tenantPayload.Store_Manager_Name || null,
            store_manager_phone: tenantPayload.Store_Manager_Phone || null,
            billing_contact_email: tenantPayload.Billing_Contact_Email || null,
            nexus_leasing_lead: tenantPayload.Nexus_Leasing_Lead || null,
            lease_start_date: tenantPayload.Lease_Start_Date || null,
            lease_expiry_date: tenantPayload.Lease_Expiry_Date || null,
            mg_rent_monthly: numberOrNull(tenantPayload.MG_Rent_Monthly),
            gto_percent: numberOrNull(tenantPayload.GTO_Percent),
            security_deposit: numberOrNull(tenantPayload.Security_Deposit),
            unit_gla_sba: numberOrNull(tenantPayload.Unit_GLA_SBA),
            power_load_kva: numberOrNull(tenantPayload.Power_Load_kVA),
            gas_connection_yn: tenantPayload.Gas_Connection_YN || null,
            water_inlet_yn: tenantPayload.Water_Inlet_YN || null,
            exhaust_provision_yn: tenantPayload.Exhaust_Provision_YN || null,
            insurance_expiry: tenantPayload.Insurance_Expiry || null,
            trade_license_expiry: tenantPayload.Trade_License_Expiry || null,
            last_audit_score: numberOrNull(tenantPayload.Last_Audit_Score),
            source_payload: tenantPayload,
          });

          await admin.from("document_memory_entries").insert({
            document_id: document.id,
            kind: "structured_fields",
            title: tenantPayload.Brand_Name,
            structured_payload: {
              missingFields: missing,
              sourcePayload: tenantPayload,
            },
          });
        }
      }
    } else if (rentRollRows || financeSummaryRows) {
      const structuredRows = (rentRollRows ?? []).map(mapRentRollRowToTenantPayload);
      const brandStatsByName = new Map(
        (brandStatsRows ?? [])
          .filter((row) => row && (row["Brand Name"] || row["Customer Name"]))
          .map((row) => [String(row["Brand Name"] || row["Customer Name"]).trim().toLowerCase(), row]),
      );

      for (const tenantPayload of structuredRows) {
        if (!tenantPayload.Brand_Name) {
          continue;
        }

        const { data: existingTenant } = await admin
          .from("tenant_profiles")
          .select("brand_name, unit_code, source_payload")
          .eq("brand_name", tenantPayload.Brand_Name)
          .eq("unit_code", tenantPayload.Unit_Code || "Unassigned")
          .maybeSingle();

        conflicts = conflicts.concat(conflictEntries(existingTenant?.source_payload, tenantPayload));
      }

      if (conflicts.length > 0 && !body.allowOverwrite) {
        return sendJson(res, 200, {
          requiresConfirmation: true,
          conflicts,
        });
      }

      for (const tenantPayload of structuredRows) {
        if (!tenantPayload.Brand_Name) {
          continue;
        }

        await admin.from("tenant_profiles").upsert({
          brand_name: tenantPayload.Brand_Name,
          unit_code: tenantPayload.Unit_Code || "Unassigned",
          rent_amount: numberOrNull(tenantPayload.MG_Rent_Monthly),
          parent_company: tenantPayload.Parent_Company || null,
          category_primary: tenantPayload.Category_Primary || null,
          category_secondary: tenantPayload.Category_Secondary || null,
          lease_start_date: tenantPayload.Lease_Start_Date || null,
          lease_expiry_date: tenantPayload.Lease_Expiry_Date || null,
          mg_rent_monthly: numberOrNull(tenantPayload.MG_Rent_Monthly),
          gto_percent: numberOrNull(tenantPayload.GTO_Percent),
          security_deposit: numberOrNull(tenantPayload.Security_Deposit),
          unit_gla_sba: numberOrNull(tenantPayload.Unit_GLA_SBA),
          power_load_kva: numberOrNull(tenantPayload.Power_Load_kVA),
          gas_connection_yn: tenantPayload.Gas_Connection_YN || null,
          water_inlet_yn: tenantPayload.Water_Inlet_YN || null,
          exhaust_provision_yn: tenantPayload.Exhaust_Provision_YN || null,
          insurance_expiry: tenantPayload.Insurance_Expiry || null,
          trade_license_expiry: tenantPayload.Trade_License_Expiry || null,
          last_audit_score:
            numberOrNull(brandStatsByName.get(String(tenantPayload.Brand_Name || "").trim().toLowerCase())?.["Health Ratio"]) ??
            numberOrNull(tenantPayload.Last_Audit_Score),
          source_payload: {
            ...tenantPayload,
            brandStats: brandStatsByName.get(String(tenantPayload.Brand_Name || "").trim().toLowerCase()) || null,
            financeWorkbook: true,
          },
        });
      }

      await admin.from("document_memory_entries").insert({
        document_id: document.id,
        kind: "structured_fields",
        title: document.file_name,
        structured_payload: {
          financeSummaryRows: financeSummaryRows ?? [],
          rentRollRowsCount: rentRollRows?.length ?? 0,
          brandStatsRowsCount: brandStatsRows?.length ?? 0,
          sourcePayload: payload,
        },
      });
    } else if (document.domain_category === "leasing" && payload.Brand_Name) {
      const { data: existingTenant } = await admin
        .from("tenant_profiles")
        .select("brand_name, unit_code, source_payload")
        .eq("brand_name", payload.Brand_Name)
        .maybeSingle();

      conflicts = conflictEntries(existingTenant?.source_payload, payload);

      if (conflicts.length > 0 && !body.allowOverwrite) {
        return sendJson(res, 200, {
          requiresConfirmation: true,
          conflicts,
        });
      }

      const missing = findMissingFields(payload, tenantRequiredFields);

      await admin.from("tenant_profiles").upsert({
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

      await admin.from("document_memory_entries").insert({
        document_id: document.id,
        kind: "structured_fields",
        title: payload.Brand_Name,
        structured_payload: {
          missingFields: missing,
          sourcePayload: payload,
        },
      });
    } else {
      const { data: existingOrg } = await admin
        .from("organization_profiles")
        .select("source_payload")
        .limit(1)
        .maybeSingle();

      conflicts = conflictEntries(existingOrg?.source_payload, payload);

      if (conflicts.length > 0 && !body.allowOverwrite) {
        return sendJson(res, 200, {
          requiresConfirmation: true,
          conflicts,
        });
      }

      const missing = findMissingFields(payload, organizationRequiredFields);

      await admin.from("organization_profiles").upsert({
        organization_name: payload.Organization_Name || "Vetturo",
        organization_code: payload.Organization_Code || null,
        org_website_url: payload.Org_Website_URL || null,
        primary_brand_color: payload.Primary_Brand_Color || null,
        secondary_brand_color: payload.Secondary_Brand_Color || null,
        portfolio_size_count: numberOrNull(payload.Portfolio_Size_Count),
        standard_hours_open: payload.Standard_Hours_Open || null,
        standard_hours_close: payload.Standard_Hours_Close || null,
        onboarding_lead_name: payload.Onboarding_Lead_Name || null,
        onboarding_lead_email: payload.Onboarding_Lead_Email || null,
        source_payload: payload,
      });

      await admin.from("document_memory_entries").insert({
        document_id: document.id,
        kind: "structured_fields",
        title: payload.Organization_Name || "Organization onboarding",
        structured_payload: {
          missingFields: missing,
          sourcePayload: payload,
        },
      });
    }

    await admin
      .from("documents")
      .update({
        status: "approved",
        is_in_core_memory: true,
        conflict_count: conflicts.length,
      })
      .eq("id", body.documentId);

    return sendJson(res, 200, { ok: true, conflictCount: conflicts.length });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Document approval failed.",
    });
  }
}
