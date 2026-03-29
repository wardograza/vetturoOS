import { admin, readJsonBody, sendJson } from "./_lib/supabase.js";
import { callOpenAI } from "./_lib/openai.js";

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function trimList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function safeParseJson(text) {
  if (!(typeof text === "string" && text.trim())) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildTenantContext(tenants) {
  return tenants.map((tenant) => ({
    brandName: tenant.brand_name,
    category: tenant.category_primary,
    unit: tenant.unit_code,
    floor: tenant.source_payload?.Floor || tenant.source_payload?.Level || null,
    rent: tenant.rent_amount,
    expiry: tenant.lease_expiry_date,
    audit: tenant.last_audit_score,
    categorySecondary: tenant.category_secondary,
    parentCompany: tenant.parent_company,
  }));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const body = await readJsonBody(req);

    const { data: tenantRows, error: tenantError } = await admin
      .from("tenant_profiles")
      .select("brand_name, category_primary, category_secondary, unit_code, rent_amount, lease_expiry_date, last_audit_score, parent_company, source_payload")
      .limit(500);

    if (tenantError) {
      throw tenantError;
    }

    const tenantContext = buildTenantContext(tenantRows || []);
    const candidateBrandName = String(body.candidateBrandName || "").trim();
    const category = String(body.category || "").trim();
    const targetUnit = String(body.targetUnit || "").trim();
    const replacementBrand = String(body.replacementBrand || "").trim();
    const areaContext = String(body.areaContext || "").trim();
    const specificQuestion = String(body.specificQuestion || "").trim();

    if (!candidateBrandName) {
      return sendJson(res, 400, { error: "Please enter the candidate brand name before running leasing intel." });
    }

    const modelInput = {
      candidateBrandName,
      category,
      targetUnit,
      replacementBrand,
      areaContext,
      specificQuestion,
      existingTenantSnapshot: tenantContext.slice(0, 200),
    };

    let analysisReply = "";
    try {
      analysisReply = await callOpenAI({
        model: "gpt-4.1-mini",
        system:
          "You are Vetturo's leasing intelligence copilot for shopping malls. Return strict JSON with keys summary, categorySynergy, technicalFit, financialHealth, cannibalizationRisk, fitScore, recommendation, targetUnit, replacementBrand, demandSignals, adjacencyNotes, replacementRationale, footfallPotential, revenuePotential, whyNow, risks, sources. Use the provided tenant context plus live web search to assess whether this candidate brand fits the mall and what unit or replacement opportunity makes the most sense. Keep it operator-ready and specific.",
        input: JSON.stringify(modelInput),
        responseFormat: "json",
        tools: [
          {
            type: "web_search_preview",
          },
        ],
      });
    } catch (_error) {
      analysisReply = await callOpenAI({
        model: "gpt-4.1-mini",
        system:
          "You are Vetturo's leasing intelligence copilot for shopping malls. Return strict JSON with keys summary, categorySynergy, technicalFit, financialHealth, cannibalizationRisk, fitScore, recommendation, targetUnit, replacementBrand, demandSignals, adjacencyNotes, replacementRationale, footfallPotential, revenuePotential, whyNow, risks, sources. Use only the provided tenant context when web search is unavailable.",
        input: JSON.stringify(modelInput),
        responseFormat: "json",
      });
    }

    const parsed =
      safeParseJson(analysisReply) ||
      {
        summary: analysisReply || "Leasing research completed, but the response came back in a partial format.",
        categorySynergy: 0,
        technicalFit: 0,
        financialHealth: 0,
        cannibalizationRisk: 0,
        fitScore: 0,
        recommendation: "Review",
        targetUnit,
        replacementBrand,
        demandSignals: [],
        adjacencyNotes: "",
        replacementRationale: "",
        footfallPotential: "",
        revenuePotential: "",
        whyNow: "",
        risks: [],
        sources: [],
      };
    const payload = {
      candidate_brand_name: candidateBrandName,
      category: category || "Unspecified",
      category_synergy: numeric(parsed.categorySynergy, 0),
      technical_fit: numeric(parsed.technicalFit, 0),
      financial_health: numeric(parsed.financialHealth, 0),
      cannibalization_risk: numeric(parsed.cannibalizationRisk, 0),
      total_score: numeric(parsed.fitScore, 0),
      recommendation: String(parsed.recommendation || "Review"),
      research_summary: String(parsed.summary || ""),
      target_unit: String(parsed.targetUnit || targetUnit || ""),
      replacement_brand: String(parsed.replacementBrand || replacementBrand || ""),
      demand_signals: trimList(parsed.demandSignals),
      sources: trimList(parsed.sources),
    };

    const { data, error } = await admin.from("decision_dna_scores").insert(payload).select("id").single();
    if (error) {
      throw error;
    }

    return sendJson(res, 200, {
      ok: true,
      id: data.id,
      analysis: {
        summary: payload.research_summary,
        recommendation: payload.recommendation,
        fitScore: payload.total_score,
        categorySynergy: payload.category_synergy,
        technicalFit: payload.technical_fit,
        financialHealth: payload.financial_health,
        cannibalizationRisk: payload.cannibalization_risk,
        targetUnit: payload.target_unit,
        replacementBrand: payload.replacement_brand,
        demandSignals: payload.demand_signals,
        sources: payload.sources,
        adjacencyNotes: String(parsed.adjacencyNotes || ""),
        replacementRationale: String(parsed.replacementRationale || ""),
        footfallPotential: String(parsed.footfallPotential || ""),
        revenuePotential: String(parsed.revenuePotential || ""),
        whyNow: String(parsed.whyNow || ""),
        risks: trimList(parsed.risks),
      },
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Leasing intelligence failed.",
    });
  }
}
