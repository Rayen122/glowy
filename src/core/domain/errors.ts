/** Erreur métier transmise telle quelle au client (code stable + message lisible). */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (code: string, message: string, details?: unknown) => new AppError(400, code, message, details);
export const unauthorized = (message = "Connexion requise.") => new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "Accès refusé.") => new AppError(403, "FORBIDDEN", message);
export const notFound = (message = "Ressource introuvable.") => new AppError(404, "NOT_FOUND", message);
export const conflict = (code: string, message: string) => new AppError(409, code, message);

