/**
 * Appels à l'API depuis les composants client : réponse { data } ou erreur { error: { code, message } }.
 * Les codes d'erreur stables (SLOT_TAKEN, EMAIL_TAKEN…) sont traduits côté interface (t.errors).
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: { path: string; message: string }[]
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, options: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? (options.body ? "POST" : "GET"),
      headers: options.body ? { "content-type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Connexion impossible. Vérifiez votre réseau.");
  }
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, json?.error?.code ?? `HTTP_${response.status}`, json?.error?.message ?? "Erreur inattendue.", json?.error?.details);
  }
  return json.data as T;
}

/** N'accepte qu'un chemin interne comme destination après connexion (évite les redirections ouvertes) */
export const safeCallback = (url?: string | null) => (url && url.startsWith("/") && !url.startsWith("//") ? url : null);
