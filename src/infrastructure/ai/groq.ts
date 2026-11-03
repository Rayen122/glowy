/**
 * Client Groq (API compatible OpenAI) : grands modèles ouverts, très rapides, clé gratuite sans carte
 * sur https://console.groq.com/keys. Actif si GROQ_API_KEY est renseignée dans .env (jamais pendant les tests).
 */

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export const groqEnabled = () => process.env.NODE_ENV !== "test" && Boolean(process.env.GROQ_API_KEY?.trim());
/** GPT-OSS 120B : modèle de production de Groq, le plus fort de son offre gratuite */
export const groqModel = () => process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";

type GroqResponse = { choices?: { message?: { content?: string | null }; finish_reason?: string }[] };

/** Réponse JSON conforme au schéma (JSON Schema standard, sortie structurée stricte) */
export async function groqJson<T>(instruction: string, text: string, schema: object, { temperature = 0.3, model = groqModel() } = {}): Promise<T> {
  let response = await send(instruction, text, schema, temperature, model);
  // Quota par minute atteint mais libéré dans moins de 4 s : on patiente une fois plutôt que de changer de modèle
  const wait = Number(response.headers.get("retry-after"));
  if (response.status === 429 && wait > 0 && wait <= 4) {
    await new Promise((resolve) => setTimeout(resolve, wait * 1000));
    response = await send(instruction, text, schema, temperature, model);
  }
  if (!response.ok) throw new Error(`Groq ${response.status} : ${(await response.text()).slice(0, 300)}`);
  const data = (await response.json()) as GroqResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Groq : réponse vide (${data.choices?.[0]?.finish_reason ?? "sans choix"})`);
  return JSON.parse(content) as T;
}

function send(instruction: string, text: string, schema: object, temperature: number, model: string) {
  return fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY!.trim()}` },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: "system", content: instruction },
        { role: "user", content: text },
      ],
      response_format: { type: "json_schema", json_schema: { name: "reponse", strict: true, schema } },
      // Modèles à raisonnement (gpt-oss) : réflexion courte, pour répondre en 1 à 2 s
      ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
}
