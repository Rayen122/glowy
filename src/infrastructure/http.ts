import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError, badRequest, forbidden } from "@/core/domain/errors";

/**
 * Outils des routes API : réponses uniformes { data } / { error: { code, message, details } },
 * validation Zod et protection CSRF (vérification de l'origine sur les requêtes qui modifient des données).
 */
export const ok = (data: unknown, init?: ResponseInit) => NextResponse.json({ data }, init);

export function toErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: { code: error.code, message: error.message, details: error.details } }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
    return NextResponse.json({ error: { code: "VALIDATION", message: "Données invalides.", details } }, { status: 400 });
  }
  console.error("[api]", error);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Erreur interne. Réessayez plus tard." } }, { status: 500 });
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Refuse les requêtes d'écriture venant d'un autre site (protection CSRF, cahier §10). */
function assertSameOrigin(request: Request) {
  if (SAFE_METHODS.has(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin) return; // appels serveur à serveur, tests : pas d'en-tête Origin
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host || new URL(origin).host !== host) throw forbidden("Origine de la requête refusée.");
}

/** Enveloppe une route API : contrôle d'origine + conversion des erreurs en réponses JSON. */
export function route<Ctx = unknown>(handler: (request: Request, ctx: Ctx) => Promise<Response>) {
  return async (request: Request, ctx: Ctx) => {
    try {
      assertSameOrigin(request);
      return await handler(request, ctx);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw badRequest("INVALID_JSON", "Corps de requête JSON invalide.");
  }
  return schema.parse(body);
}

export const readQuery = <T>(request: Request, schema: ZodType<T>): T =>
  schema.parse(Object.fromEntries(new URL(request.url).searchParams));
