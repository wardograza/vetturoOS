function extractOutputText(responseJson) {
  if (typeof responseJson.output_text === "string" && responseJson.output_text.trim()) {
    return responseJson.output_text;
  }

  if (Array.isArray(responseJson.output)) {
    const chunks = [];

    responseJson.output.forEach((item) => {
      if (Array.isArray(item?.content)) {
        item.content.forEach((content) => {
          if (typeof content?.text === "string" && content.text.trim()) {
            chunks.push(content.text);
          } else if (typeof content?.output_text === "string" && content.output_text.trim()) {
            chunks.push(content.output_text);
          }
        });
      }
    });

    if (chunks.length > 0) {
      return chunks.join("\n").trim();
    }
  }

  return "";
}

export async function callOpenAI({ system, input, responseFormat = "text", model = "gpt-4.1-mini", tools, toolChoice }) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: system,
        },
        {
          role: "user",
          content: input,
        },
      ],
      text:
        responseFormat === "json"
          ? {
              format: {
                type: "json_object",
              },
            }
          : undefined,
      tools,
      tool_choice: toolChoice,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error: ${text}`);
  }

  const json = await response.json();
  return extractOutputText(json);
}

export function classifyDocumentFallback({ fileName = "", notes = "" }) {
  const source = `${fileName} ${notes}`.toLowerCase();

  if (source.includes("lease") || source.includes("tenant") || source.includes("onboarding")) {
    return {
      domain: "leasing",
      subCategory: "tenant-onboarding",
      purposeSummary: "Likely used for tenant onboarding, lease understanding, or leasing memory.",
      followUpQuestion:
        "This looks like a leasing/onboarding document. Is it meant to add or update tenant, lease, or mall onboarding data?",
    };
  }

  if (source.includes("budget") || source.includes("finance") || source.includes("rent")) {
    return {
      domain: "finance",
      subCategory: "budget",
      purposeSummary: "Likely used for finance or budget memory.",
      followUpQuestion:
        "This looks finance-related. Should I store it under budgets, rent roll, or recovery context?",
    };
  }

  if (source.includes("license") || source.includes("insurance") || source.includes("legal")) {
    return {
      domain: "legal",
      subCategory: "compliance",
      purposeSummary: "Likely used for legal or compliance memory.",
      followUpQuestion:
        "This appears legal or compliance-oriented. Is this for licenses, insurance, or another legal record?",
    };
  }

  return {
    domain: "operations",
    subCategory: "sop",
    purposeSummary: "General operating document requiring human confirmation before memory storage.",
    followUpQuestion:
      "I need one more detail: is this document mainly for operations, finance, leasing, legal, marketing, or sales?",
  };
}
