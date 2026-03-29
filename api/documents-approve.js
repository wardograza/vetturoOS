import { admin, readJsonBody, sendJson } from "./_lib/supabase.js";
import { findMissingFields, organizationRequiredFields, tenantRequiredFields } from "./_lib/workbook.js";

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized || normalized === "-" || normalized.toLowerCase() === "na" || normalized.toLowerCase() === "n/a") {
    return null;
  }

  const parsed = Number(normalized.replace(/,/g, "").replace(/%/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized || normalized === "-" || normalized.toLowerCase() === "na" || normalized.toLowerCase() === "n/a") {
    return null;
  }

  return normalized;
}

function dateOrNull(value) {
  const normalized = textOrNull(value);
  if (!normalized) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const dashMatch = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, day, month, year] = dashMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const slashMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dayOrMonth, monthOrDay, year] = slashMatch;
    const first = Number(dayOrMonth);
    const second = Number(monthOrDay);
    const day = first > 12 ? first : second;
    const month = first > 12 ? second : first;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function buildTenantUpsertPayload(tenantPayload, extra = {}) {
  return {
    brand_name: textOrNull(tenantPayload.Brand_Name),
    unit_code: textOrNull(tenantPayload.Unit_Code) || "Unassigned",
    rent_amount: numberOrNull(tenantPayload.MG_Rent_Monthly) ?? 0,
    parent_company: textOrNull(tenantPayload.Parent_Company),
    category_primary: textOrNull(tenantPayload.Category_Primary),
    category_secondary: textOrNull(tenantPayload.Category_Secondary),
    brand_grade: textOrNull(tenantPayload.Brand_Grade),
    brand_poc_name: textOrNull(tenantPayload.Brand_POC_Name),
    brand_poc_email: textOrNull(tenantPayload.Brand_POC_Email),
    store_manager_name: textOrNull(tenantPayload.Store_Manager_Name),
    store_manager_phone: textOrNull(tenantPayload.Store_Manager_Phone),
    billing_contact_email: textOrNull(tenantPayload.Billing_Contact_Email),
    nexus_leasing_lead: textOrNull(tenantPayload.Nexus_Leasing_Lead),
    store_format: textOrNull(tenantPayload.Store_Format),
    target_audience: textOrNull(tenantPayload.Target_Audience),
    avg_transaction_value: numberOrNull(tenantPayload.Avg_Transaction_Value),
    annual_marketing_spend: numberOrNull(tenantPayload.Annual_Marketing_Spend),
    usp_description: textOrNull(tenantPayload.USP_Description),
    expansion_history: textOrNull(tenantPayload.Expansion_History),
    lease_start_date: dateOrNull(tenantPayload.Lease_Start_Date),
    lease_expiry_date: dateOrNull(tenantPayload.Lease_Expiry_Date),
    lock_in_expiry: dateOrNull(tenantPayload.Lock_in_Expiry),
    mg_rent_monthly: numberOrNull(tenantPayload.MG_Rent_Monthly),
    gto_percent: numberOrNull(tenantPayload.GTO_Percent),
    escalation_freq_months: numberOrNull(tenantPayload.Escalation_Freq_Months),
    escalation_percent: numberOrNull(tenantPayload.Escalation_Percent),
    last_escalation_date: dateOrNull(tenantPayload.Last_Escalation_Date),
    security_deposit: numberOrNull(tenantPayload.Security_Deposit),
    cam_rate_sqft: numberOrNull(tenantPayload.CAM_Rate_SqFt),
    utility_meter_id: textOrNull(tenantPayload.Utility_Meter_ID),
    unit_gla_sba: numberOrNull(tenantPayload.Unit_GLA_SBA),
    power_load_kva: numberOrNull(tenantPayload.Power_Load_kVA),
    gas_connection_yn: textOrNull(tenantPayload.Gas_Connection_YN),
    water_inlet_yn: textOrNull(tenantPayload.Water_Inlet_YN),
    exhaust_provision_yn: textOrNull(tenantPayload.Exhaust_Provision_YN),
    signage_type: textOrNull(tenantPayload.Signage_Type),
    insurance_expiry: dateOrNull(tenantPayload.Insurance_Expiry),
    trade_license_expiry: dateOrNull(tenantPayload.Trade_License_Expiry),
    last_audit_score: numberOrNull(tenantPayload.Last_Audit_Score),
    source_payload: tenantPayload,
    ...extra,
  };
}

function conflictEntries(existing, incoming) {
  if (!existing) {
    return [];
  }

  return Object.entries(incoming).filter(([key, value]) => {
    if (value === undefined || value === null || String(value).trim() === "") {
      return false;
    }
    const current = existing[key];
    return current !== undefined && current !== null && String(current) !== String(value);
  });
}

function uniqueConflictEntries(entries) {
  const seen = new Set();
  return entries.filter(([key]) => {
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
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
    const workbookType = payload.workbookType || null;
    const templateScope = payload.templateScope || null;
    let conflicts = [];

    if (organizationPayload || tenantPayloads) {
      const isOnboardingTemplate = workbookType === "onboarding";
      const replaceOrganizationSnapshot =
        isOnboardingTemplate && Boolean(organizationPayload) && ["organization", "combined"].includes(templateScope);
      const replaceTenantSnapshot =
        isOnboardingTemplate && Array.isArray(tenantPayloads) && tenantPayloads.length > 0 && ["location", "combined"].includes(templateScope);

      if (organizationPayload) {
        if (!replaceOrganizationSnapshot) {
          const { data: existingOrg } = await admin
            .from("organization_profiles")
            .select("source_payload")
            .limit(1)
            .maybeSingle();

          conflicts = conflicts.concat(conflictEntries(existingOrg?.source_payload, organizationPayload));
          conflicts = uniqueConflictEntries(conflicts);

          if (conflicts.length > 0 && !body.allowOverwrite) {
            return sendJson(res, 200, {
              requiresConfirmation: true,
              conflicts,
            });
          }
        }

        const missing = findMissingFields(organizationPayload, organizationRequiredFields);

        if (replaceOrganizationSnapshot) {
          await admin.from("organization_profiles").delete().not("id", "is", null);
        }

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
        if (!replaceTenantSnapshot) {
          for (const tenantPayload of tenantPayloads) {
            const { data: existingTenant } = await admin
              .from("tenant_profiles")
              .select("brand_name, unit_code, source_payload")
              .eq("brand_name", tenantPayload.Brand_Name)
              .eq("unit_code", tenantPayload.Unit_Code || "Unassigned")
              .maybeSingle();

            conflicts = conflicts.concat(conflictEntries(existingTenant?.source_payload, tenantPayload));
          }
          conflicts = uniqueConflictEntries(conflicts);

          if (conflicts.length > 0 && !body.allowOverwrite) {
            return sendJson(res, 200, {
              requiresConfirmation: true,
              conflicts,
            });
          }
        } else {
          await admin.from("tenant_profiles").delete().not("id", "is", null);
        }

        for (const tenantPayload of tenantPayloads) {
          const missing = findMissingFields(tenantPayload, tenantRequiredFields);
          const upsertResult = await admin
            .from("tenant_profiles")
            .upsert(buildTenantUpsertPayload(tenantPayload));

          if (upsertResult.error) {
            throw new Error(
              `Tenant onboarding failed for ${tenantPayload.Brand_Name || "an unknown brand"} (${tenantPayload.Unit_Code || "no unit"}). ${upsertResult.error.message}`,
            );
          }

          await admin.from("document_memory_entries").insert({
            document_id: document.id,
            kind: "structured_fields",
            title: tenantPayload.Brand_Name,
            structured_payload: {
              missingFields: missing,
              sourcePayload: tenantPayload,
              templateScope,
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
      conflicts = uniqueConflictEntries(conflicts);

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

        const upsertResult = await admin.from("tenant_profiles").upsert(
          buildTenantUpsertPayload(tenantPayload, {
            last_audit_score:
              numberOrNull(brandStatsByName.get(String(tenantPayload.Brand_Name || "").trim().toLowerCase())?.["Health Ratio"]) ??
              numberOrNull(tenantPayload.Last_Audit_Score),
            source_payload: {
              ...tenantPayload,
              brandStats: brandStatsByName.get(String(tenantPayload.Brand_Name || "").trim().toLowerCase()) || null,
              financeWorkbook: true,
            },
          }),
        );

        if (upsertResult.error) {
          throw new Error(
            `Finance workbook ingest failed for ${tenantPayload.Brand_Name || "an unknown brand"} (${tenantPayload.Unit_Code || "no unit"}). ${upsertResult.error.message}`,
          );
        }
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

      conflicts = uniqueConflictEntries(conflictEntries(existingTenant?.source_payload, payload));

      if (conflicts.length > 0 && !body.allowOverwrite) {
        return sendJson(res, 200, {
          requiresConfirmation: true,
          conflicts,
        });
      }

      const missing = findMissingFields(payload, tenantRequiredFields);

      const upsertResult = await admin.from("tenant_profiles").upsert(buildTenantUpsertPayload(payload));

      if (upsertResult.error) {
        throw new Error(
          `Tenant memory approval failed for ${payload.Brand_Name || "an unknown brand"} (${payload.Unit_Code || "no unit"}). ${upsertResult.error.message}`,
        );
      }

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

      conflicts = uniqueConflictEntries(conflictEntries(existingOrg?.source_payload, payload));

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
