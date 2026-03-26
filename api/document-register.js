import { admin, getUserFromBearerToken, readJsonBody, sendJson } from "./_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const user = await getUserFromBearerToken(req);
    const body = await readJsonBody(req);

    const { data, error } = await admin
      .from("documents")
      .insert({
        uploaded_by: user?.id || null,
        file_name: body.fileName,
        storage_path: body.storagePath,
        document_type: body.documentType || "onboarding",
        domain_category: body.domainCategory || null,
        sub_category: body.subCategory || null,
        purpose_summary: body.purposeSummary || null,
        parser_summary: body.parserSummary || null,
        status: "pending_approval",
        source_payload: body.sourcePayload || null,
        conflict_count: 0,
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return sendJson(res, 200, { ok: true, id: data.id });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Document registration failed.",
    });
  }
}
