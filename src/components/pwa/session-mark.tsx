import { createHash } from "node:crypto";

/**
 * Empreinte de la session (compte ou visiteur) dans la page, sans donnée personnelle : quand elle change (connexion,
 * déconnexion, autre compte), pwa.tsx fait refaire les pages enregistrées pour le hors-ligne. Sinon, une fois
 * connectée, la cliente retrouverait hors connexion les pages enregistrées en visiteuse (« Se connecter »).
 */
export function SessionMark({ userId }: { userId?: string | null }) {
  const mark = userId ? createHash("sha256").update(`glowy:${userId}`).digest("base64url").slice(0, 16) : "visiteur";
  return <meta name="glowy-session" content={mark} />;
}
