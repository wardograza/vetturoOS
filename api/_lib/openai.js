export async function callOpenAI({ system, input, responseFormat = "text" }) {
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
      model: "gpt-4.1-mini",
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
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error: ${text}`);
  }

  const json = await response.json();
  return json.output_text ?? "";
}
