import { admin, readJsonBody, sendJson } from "./_lib/supabase.js";

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const body = await readJsonBody(req);

    const categorySynergy = numeric(body.categorySynergy);
    const technicalFit = numeric(body.technicalFit);
    const financialHealth = numeric(body.financialHealth);
    const cannibalizationRisk = numeric(body.cannibalizationRisk);
    const totalScore = Number(
      ((categorySynergy + technicalFit + financialHealth + (100 - cannibalizationRisk)) / 4).toFixed(2),
    );

    const { error } = await admin.from("decision_dna_scores").insert({
      candidate_brand_name: body.candidateBrandName,
      category: body.category,
      category_synergy: categorySynergy,
      technical_fit: technicalFit,
      financial_health: financialHealth,
      cannibalization_risk: cannibalizationRisk,
      total_score: totalScore,
      recommendation: totalScore >= 70 ? "Go" : "Review",
    });

    if (error) {
      throw error;
    }

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Leasing intelligence save failed.",
    });
  }
}
