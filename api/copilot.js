import { admin, readJsonBody, sendJson } from "./_lib/supabase.js";
import { callOpenAI, classifyDocumentFallback } from "./_lib/openai.js";
import { findMissingFields, organizationRequiredFields, tenantRequiredFields } from "./_lib/workbook.js";

function currency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function findBrandMatches(rows, normalizedMessage) {
  const tokens = normalizedMessage
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  return rows.filter((row) => {
    const brand = String(row.brandName || "").toLowerCase();
    return tokens.some((token) => brand.includes(token));
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const body = await readJsonBody(req);
    const mode = body.mode || "chat";
    const message = String(body.message || "");

    if (mode === "classify_document") {
      try {
        const reply = await callOpenAI({
          system:
            "You classify mall-management documents. Return strict JSON with keys domain, subCategory, purposeSummary, followUpQuestion. Domains: finance, leasing, legal, operations, marketing, sales.",
          input: JSON.stringify({
            fileName: body.fileName,
            notes: body.notes,
            existingSelection: body.existingSelection,
          }),
          responseFormat: "json",
        });

        return sendJson(res, 200, JSON.parse(reply));
      } catch (_error) {
        return sendJson(res, 200, classifyDocumentFallback(body));
      }
    }

    const [tenantProfilesResult, legacyTenantsResult, organizationResult, taskResult, documentResult] =
      await Promise.all([
        admin.from("tenant_profiles").select("brand_name, unit_code, rent_amount, category_primary, source_payload").limit(500),
        admin.from("tenants").select("tenant_name, unit_number, rent").limit(500),
        admin.from("organization_profiles").select("organization_name, source_payload").limit(1).maybeSingle(),
        admin.from("tasks").select("title, department, priority, status").limit(50),
        admin.from("documents").select("file_name, domain_category, sub_category, source_payload, status").limit(50),
      ]);

    const tenantProfiles = tenantProfilesResult.error ? [] : tenantProfilesResult.data ?? [];
    const legacyTenants = legacyTenantsResult.error ? [] : legacyTenantsResult.data ?? [];
    const organization = organizationResult.error ? null : organizationResult.data;
    const tasks = taskResult.error ? [] : taskResult.data ?? [];
    const documents = documentResult.error ? [] : documentResult.data ?? [];

    const normalized = message.toLowerCase();
    const rows = tenantProfiles.length > 0
      ? tenantProfiles.map((row) => ({
          brandName: row.brand_name,
          unitCode: row.unit_code,
          rent: Number(row.rent_amount ?? row.source_payload?.MG_Rent_Monthly ?? 0),
          categoryPrimary: row.category_primary ?? row.source_payload?.Category_Primary ?? null,
          sourcePayload: row.source_payload ?? {},
        }))
      : legacyTenants.map((row) => ({
          brandName: row.tenant_name,
          unitCode: row.unit_number,
          rent: Number(row.rent ?? 0),
          categoryPrimary: null,
          sourcePayload: {
            Brand_Name: row.tenant_name,
            Unit_Code: row.unit_number,
            MG_Rent_Monthly: row.rent,
          },
        }));

    if (normalized.includes("missing") || normalized.includes("onboarding")) {
      const tenantGaps = rows
        .map((row) => ({
          brandName: row.brandName,
          missing: findMissingFields(row.sourcePayload || {}, tenantRequiredFields),
        }))
        .filter((row) => row.missing.length > 0)
        .slice(0, 10);

      const orgMissing = organization
        ? findMissingFields(organization.source_payload || {}, organizationRequiredFields)
        : organizationRequiredFields;

      const parts = [];

      if (orgMissing.length > 0) {
        parts.push(`Organization onboarding is missing: ${orgMissing.join(", ")}`);
      }

      if (tenantGaps.length > 0) {
        parts.push(
          tenantGaps
            .map((gap) => `${gap.brandName}: ${gap.missing.join(", ")}`)
            .join(" | "),
        );
      }

      return sendJson(res, 200, {
        reply:
          parts.length > 0
            ? parts.join("\n")
            : "Core onboarding fields look complete for the currently stored organization and tenant records.",
      });
    }

    if (normalized.includes("revenue") || normalized.includes("made") || normalized.includes("rent")) {
      const total = rows.reduce((sum, row) => sum + Number(row.rent || 0), 0);
      const matching = findBrandMatches(rows, normalized);

      if (matching.length > 0) {
        const totalMatching = matching.reduce((sum, row) => sum + Number(row.rent || 0), 0);
        return sendJson(res, 200, {
          reply: `${matching[0].brandName} is currently mapped to ${matching.length} record(s) with total tracked rent of ${currency(totalMatching)}.`,
          action: { page: "Revenue" },
        });
      }

      return sendJson(res, 200, {
        reply: `Across the currently tracked tenant records, the total mapped rent base is ${currency(total)}.`,
        action: { page: "Revenue" },
      });
    }

    try {
      const aiReply = await callOpenAI({
        system:
          "You are Vetturo, a mall operations copilot. Answer using the provided JSON context only. If information is missing, explicitly say what onboarding data is missing and what the client must provide. Keep answers concise and operational.",
        input: JSON.stringify({
          userMessage: message,
          organization,
          tenants: rows.slice(0, 50),
          tasks: tasks.slice(0, 20),
          documents: documents.slice(0, 20),
        }),
      });

      return sendJson(res, 200, { reply: aiReply });
    } catch (_error) {
      return sendJson(res, 200, {
        reply:
          "OpenAI credits are unavailable right now, so I’ve fallen back to deterministic workspace logic. I can still answer revenue totals, onboarding gaps, and other structured data questions from the current database.",
      });
    }
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Copilot failed.",
    });
  }
}
