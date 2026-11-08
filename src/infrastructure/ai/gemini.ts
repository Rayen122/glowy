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

/** Erreurs passagères qui méritent une nouvelle tentative : délai dépassé, quota par minute, surcharge du service */
const RETRY_STATUS = [429, 500, 503];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Réponse JSON conforme au schéma, ou « blocked » quand Gemini refuse lui-même le contenu (jugé dangereux).
 * Une nouvelle tentative après une erreur passagère (`retries`), chaque essai limité à `timeoutMs`.
 */
export async function generateJson<T>(
  instruction: string,
  parts: GeminiPart[],
  schema: object,
  { temperature = 0, model = defaultModel(), timeoutMs = 15_000, retries = 1 } = {}
): Promise<T | "blocked"> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: instruction }] },
    contents: [{ role: "user", parts }],
    generationConfig: { temperature, responseMimeType: "application/json", responseSchema: schema },
    safetySettings: SAFETY_OFF,
  });
  let response: Response | null = null;
  for (let attempt = 0; ; attempt += 1) {
    try {
      response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY!.trim() },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (attempt >= retries || !["TimeoutError", "AbortError"].includes((error as Error).name)) throw error;
      await sleep(800);
      continue;
    }
    if (response.ok || attempt >= retries || !RETRY_STATUS.includes(response.status)) break;
    await sleep(response.status === 429 ? 2_500 : 1_000);
  }
  if (!response.ok) throw new Error(`Gemini ${response.status} : ${(await response.text()).slice(0, 300)}`);
  const data = (await response.json()) as GeminiResponse;
  const candidate = data.candidates?.[0];
  if (data.promptFeedback?.blockReason || BLOCKED.includes(candidate?.finishReason ?? "")) return "blocked";
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new Error(`Gemini : réponse vide (${candidate?.finishReason ?? "sans candidat"})`);
  return JSON.parse(text) as T;
}

/** Modèle d'édition d'image : Gemini 2.5 Flash Image (« Nano Banana », ~0,04 $ l'image) ; GEMINI_IMAGE_MODEL pour un autre, « off » pour couper */
export const imageModel = () => process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image";
export const imageEditEnabled = () => geminiEnabled() && imageModel() !== "off";

/** Quota épuisé, ou génération d'images absente de l'offre gratuite : facturation à activer dans Google AI Studio */
export class GeminiQuotaError extends Error {
  name = "GeminiQuotaError";
}

export type GeminiImage = { mimeType: string; data: string };
type GeminiImageResponse = {
  promptFeedback?: { blockReason?: string };
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; inlineData?: GeminiImage }[] } }[];
};

/**
 * Photo retouchée par le modèle selon la consigne, ou « blocked » quand Gemini refuse le contenu.
 * `aspectRatio` : format du rendu (« 2:3 »…), pour garder le cadrage de la photo. Chaque image est facturée :
 * une seule nouvelle tentative, seulement si le service est surchargé (500, 503 : rien n'a été généré).
 */
export async function editImage(
  instruction: string,
  image: GeminiImage,
  { model = imageModel(), aspectRatio, timeoutMs = 60_000 }: { model?: string; aspectRatio?: string; timeoutMs?: number } = {}
): Promise<GeminiImage | "blocked"> {
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: instruction }, { inline_data: { mime_type: image.mimeType, data: image.data } }] }],
    generationConfig: { responseModalities: ["IMAGE"], ...(aspectRatio ? { imageConfig: { aspectRatio } } : {}) },
  });
  let response: Response;
  for (let attempt = 0; ; attempt += 1) {
    response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY!.trim() },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.ok || attempt >= 1 || ![500, 503].includes(response.status)) break;
    await sleep(1_500);
  }
  if (response.status === 429) throw new GeminiQuotaError(`Gemini 429 : ${(await response.text()).slice(0, 300)}`);
  if (!response.ok) throw new Error(`Gemini ${response.status} : ${(await response.text()).slice(0, 300)}`);
  const data = (await response.json()) as GeminiImageResponse;
  const candidate = data.candidates?.[0];
  if (data.promptFeedback?.blockReason || BLOCKED.includes(candidate?.finishReason ?? "")) return "blocked";
  const result = candidate?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
  if (!result) throw new Error(`Gemini : aucune image rendue (${candidate?.finishReason ?? "sans candidat"})`);
  return result;
}
