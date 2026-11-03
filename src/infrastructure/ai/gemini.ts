/**
 * Client du modèle d'IA Google Gemini (clé gratuite sur https://aistudio.google.com/apikey), partagé par la modération
 * et l'assistante. Actif si GEMINI_API_KEY est renseignée dans .env ; sinon (et pendant les tests) chaque module
 * garde son fonctionnement sans IA externe.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export const geminiEnabled = () => process.env.NODE_ENV !== "test" && Boolean(process.env.GEMINI_API_KEY?.trim());
/** Alias « latest » : suit la dernière version Flash-Lite (rapide, quota gratuit le plus large) */
export const defaultModel = () => process.env.GEMINI_MODEL?.trim() || "gemini-flash-lite-latest";

/** La modération doit pouvoir lire les contenus choquants : les filtres de sécurité de Gemini sont désactivés */
const SAFETY_OFF = ["HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH", "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_DANGEROUS_CONTENT"].map((category) => ({ category, threshold: "BLOCK_NONE" }));
const BLOCKED = ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "IMAGE_SAFETY"];

export type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };
type GeminiResponse = {
  promptFeedback?: { blockReason?: string };
  candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
};

/** Réponse JSON conforme au schéma, ou « blocked » quand Gemini refuse lui-même le contenu (jugé dangereux) */
export async function generateJson<T>(instruction: string, parts: GeminiPart[], schema: object, { temperature = 0, model = defaultModel() } = {}): Promise<T | "blocked"> {
  const response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY!.trim() },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instruction }] },
      contents: [{ role: "user", parts }],
      generationConfig: { temperature, responseMimeType: "application/json", responseSchema: schema },
      safetySettings: SAFETY_OFF,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Gemini ${response.status} : ${(await response.text()).slice(0, 300)}`);
  const data = (await response.json()) as GeminiResponse;
  const candidate = data.candidates?.[0];
  if (data.promptFeedback?.blockReason || BLOCKED.includes(candidate?.finishReason ?? "")) return "blocked";
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new Error(`Gemini : réponse vide (${candidate?.finishReason ?? "sans candidat"})`);
  return JSON.parse(text) as T;
}
