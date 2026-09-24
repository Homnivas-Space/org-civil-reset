// Calls OpenRouter's free-model router. Free tier only, by design —
// see the 200 req/day cap and model-rotation caveats already discussed.
// "openrouter/free" auto-selects among currently-available free models
// so a single deprecated model doesn't silently break this route.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const FREE_MODEL = "openrouter/free";

interface OpenRouterEnv {
  OPENROUTER_API_KEY: string;
}

export type ChatResult =
  | { ok: true; content: string }
  | { ok: false; error: string; status: number };

export async function chatCompletion(
  env: OpenRouterEnv,
  systemPrompt: string,
  userPrompt: string
): Promise<ChatResult> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: FREE_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `OpenRouter ${res.status}: ${body}`, status: res.status };
  }

  const data = await res.json<{ choices?: { message?: { content?: string } }[] }>();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return { ok: false, error: "OpenRouter returned no content", status: 502 };
  }
  return { ok: true, content };
}
