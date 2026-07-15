// Serverless function (Vercel). Talks to Google's Gemini API using a free,
// no-credit-card API key (from aistudio.google.com). The key stays here on
// the server — it never reaches the browser. The response is reshaped to
// look like Anthropic's format so the frontend code doesn't need to change.

function toGeminiContents(messages) {
  return messages.map((m) => {
    const role = m.role === "assistant" ? "model" : "user";
    if (Array.isArray(m.content)) {
      const parts = m.content.map((block) => {
        if (block.type === "image") {
          return {
            inline_data: {
              mime_type: block.source.media_type,
              data: block.source.data,
            },
          };
        }
        return { text: block.text };
      });
      return { role, parts };
    }
    return { role, parts: [{ text: m.content }] };
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { system, messages } = req.body;
  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: toGeminiContents(messages),
        generationConfig: { maxOutputTokens: 2000 },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "Gemini API error" });
    }

    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") || "";

    res.status(200).json({ content: [{ type: "text", text }] });
  } catch (err) {
    res.status(500).json({ error: "Server error", detail: err.message });
  }
}
