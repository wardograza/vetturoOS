import { admin, getUserFromBearerToken, readJsonBody, sendJson } from "./_lib/supabase.js";
import { callOpenAI, classifyDocumentFallback } from "./_lib/openai.js";
import { findMissingFields, organizationRequiredFields, tenantRequiredFields } from "./_lib/workbook.js";
import { chooseTaskAssignee } from "./_lib/task-routing.js";

function currency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function findBrandMatches(rows, normalizedMessage) {
  const ignoredTokens = new Set([
    "what",
    "how",
    "much",
    "many",
    "rent",
    "revenue",
    "total",
    "overall",
    "base",
    "made",
    "show",
    "tell",
    "give",
    "numbers",
    "number",
    "current",
    "tracked",
    "brand",
    "tenant",
  ]);

  const tokens = normalizedMessage
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !ignoredTokens.has(token));

  return rows.filter((row) => {
    const brand = String(row.brandName || "").toLowerCase();
    return tokens.some((token) => brand.includes(token) || brand.split(/\s+/).includes(token));
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
    const user = await getUserFromBearerToken(req);

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

    const [tenantProfilesResult, legacyTenantsResult, organizationResult, taskResult, documentResult, profilesResult] =
      await Promise.all([
        admin.from("tenant_profiles").select("brand_name, unit_code, rent_amount, category_primary, source_payload").limit(500),
        admin.from("tenants").select("tenant_name, unit_number, rent").limit(500),
        admin.from("organization_profiles").select("organization_name, source_payload").limit(1).maybeSingle(),
        admin.from("tasks").select("title, department, priority, status, assigned_to").limit(100),
        admin.from("documents").select("file_name, domain_category, sub_category, source_payload, status").limit(50),
        admin.from("profiles").select("id, full_name, username, email, role, permissions, is_active, availability_status, pto_from, pto_to").limit(200),
      ]);

    const tenantProfiles = tenantProfilesResult.error ? [] : tenantProfilesResult.data ?? [];
    const legacyTenants = legacyTenantsResult.error ? [] : legacyTenantsResult.data ?? [];
    const organization = organizationResult.error ? null : organizationResult.data;
    const tasks = taskResult.error ? [] : taskResult.data ?? [];
    const documents = documentResult.error ? [] : documentResult.data ?? [];
    const profiles = profilesResult.error ? [] : profilesResult.data ?? [];
    const approvedFinanceDocument = documents.find(
      (document) =>
        document.status === "approved" &&
        document.source_payload &&
        (Array.isArray(document.source_payload.financeSummaryRows) ||
          Array.isArray(document.source_payload.rentRollRows)),
    );
    const financeSummaryRows = Array.isArray(approvedFinanceDocument?.source_payload?.financeSummaryRows)
      ? approvedFinanceDocument.source_payload.financeSummaryRows
      : [];
    const rentRollRows = Array.isArray(approvedFinanceDocument?.source_payload?.rentRollRows)
      ? approvedFinanceDocument.source_payload.rentRollRows
      : [];

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

    try {
      const intentReply = await callOpenAI({
        system:
          "You are Vetturo's mall-ops action router. Return strict JSON with keys intent, page, taskTitle, taskDescription, department, priority, assignee, answer. Intents: answer, navigate, create_task. Only choose create_task when the user is clearly asking to create, assign, escalate, route, or log work. Departments must be one of facilities, finance, leasing, operations. Priorities must be one of P1, P2, P3.",
        input: JSON.stringify({
          userMessage: message,
          visiblePages: ["Overview", "Tenants", "Tasks", "Communications", "Document Vault", "Leasing Intel", "Approvals", "Invite User", "Configs"],
        }),
        responseFormat: "json",
      });

      const intent = JSON.parse(intentReply);

      if (intent.intent === "create_task") {
        const taskTitle = String(intent.taskTitle || "").trim();
        const department = String(intent.department || "").trim().toLowerCase();
        const priority = String(intent.priority || "P2").trim().toUpperCase();

        if (!taskTitle || !department) {
          return sendJson(res, 200, {
            reply: "I can create that task, but I still need a clear title and the department it should go to.",
            action: { page: "Tasks" },
          });
        }

        const assigneeHint = String(intent.assignee || "").trim().toLowerCase();
        const matchedAssignee =
          assigneeHint
            ? profiles.find((profile) =>
                [profile.full_name, profile.username, profile.email]
                  .filter(Boolean)
                  .some((value) => String(value).toLowerCase().includes(assigneeHint)),
              ) ?? null
            : null;

        const assignee = chooseTaskAssignee({
          requestedAssigneeId: matchedAssignee?.id || null,
          profiles,
          tasks,
          department,
        });

        const { error: createError } = await admin.from("tasks").insert({
          title: taskTitle,
          description: String(intent.taskDescription || message).trim(),
          department,
          priority,
          status: assignee ? "assigned" : "open",
          assigned_to: assignee?.id || null,
          created_by: user?.id || null,
        });

        if (createError) {
          throw createError;
        }

        return sendJson(res, 200, {
          reply: assignee
            ? `I created "${taskTitle}" and assigned it to ${assignee.full_name || "the selected teammate"}.`
            : `I created "${taskTitle}" and left it open because no eligible assignee was available right now.`,
          action: { page: "Tasks" },
        });
      }

      if (intent.intent === "navigate" && intent.page) {
        return sendJson(res, 200, {
          reply: intent.answer || `Opening ${intent.page}.`,
          action: { page: intent.page },
        });
      }
    } catch (_intentError) {
      // If the routing model fails, continue into deterministic and QA flows.
    }

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
      const genericRevenueQuery =
        normalized.includes("total") ||
        normalized.includes("overall") ||
        normalized.includes("base") ||
        normalized.includes("portfolio");

      if (genericRevenueQuery) {
        return sendJson(res, 200, {
          reply: `Across the currently tracked tenant records, the total mapped rent base is ${currency(total)}.`,
          action: { page: "Tenants" },
        });
      }

      const matching = findBrandMatches(rows, normalized);

      if (matching.length > 0) {
        const totalMatching = matching.reduce((sum, row) => sum + Number(row.rent || 0), 0);
        return sendJson(res, 200, {
          reply: `${matching[0].brandName} is currently mapped to ${matching.length} record(s) with total tracked rent of ${currency(totalMatching)}.`,
          action: { page: "Tenants" },
        });
      }

      return sendJson(res, 200, {
        reply: `Across the currently tracked tenant records, the total mapped rent base is ${currency(total)}.`,
        action: { page: "Tenants" },
      });
    }

    if (financeSummaryRows.length > 0) {
      const findSummary = (label) =>
        financeSummaryRows.find((row) => String(row.label || "").toLowerCase() === label);

      if (normalized.includes("mg rent") || normalized.includes("minimum guarantee")) {
        const mgRow = findSummary("mg rent");
        if (mgRow) {
          return sendJson(res, 200, {
            reply: `The approved finance workbook shows MG Rent total at ${mgRow.total} with an average of ${mgRow.average}.`,
            action: { page: "Tenants" },
          });
        }
      }

      if (normalized.includes("cam")) {
        const camRow = findSummary("cam");
        if (camRow) {
          return sendJson(res, 200, {
            reply: `The approved finance workbook shows CAM total at ${camRow.total} with an average of ${camRow.average}.`,
            action: { page: "Tenants" },
          });
        }
      }

      if (normalized.includes("gto") || normalized.includes("sales")) {
        const salesRow = findSummary("gto sales");
        if (salesRow) {
          return sendJson(res, 200, {
            reply: `The approved finance workbook shows GTO Sales total at ${salesRow.total} with an average of ${salesRow.average}.`,
            action: { page: "Tenants" },
          });
        }
      }
    }

    if (rentRollRows.length > 0) {
      const matchingFinanceBrand = findBrandMatches(
        rentRollRows.map((row) => ({
          brandName: row["Brand Name"] || row["Customer Name"] || "",
        })),
        normalized,
      );

      if (matchingFinanceBrand.length > 0) {
        const matchedName = matchingFinanceBrand[0].brandName;
        const matchedRow = rentRollRows.find(
          (row) => String(row["Brand Name"] || row["Customer Name"] || "").toLowerCase() === matchedName.toLowerCase(),
        );

        if (matchedRow) {
          const mgValue = matchedRow["Current MG (Per Month)"] || matchedRow["Escalated /New Rent"] || matchedRow["Current Rent"] || matchedRow["Rent"] || "N/A";
          return sendJson(res, 200, {
            reply: `${matchedName} is in the approved rent roll for unit ${matchedRow["Unit No"] || "N/A"} with current MG ${mgValue}, category ${matchedRow["Sales Category"] || matchedRow["Category"] || "N/A"}, and lease expiry ${matchedRow["Ultimate Lease Expiry date"] || matchedRow["Original Lease End Date"] || "N/A"}.`,
            action: { page: "Tenants" },
          });
        }
      }
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
          "I can help with the structured data already in the workspace, but for this question I still need richer approved onboarding data or a clearer instruction to act on.",
      });
    }
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Copilot failed.",
    });
  }
}
