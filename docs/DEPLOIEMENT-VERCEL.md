# Déployer Glowy sur Vercel

Le site se déploie depuis GitHub (dépôt `Rayen122/glowy`) : chaque push sur la branche choisie redéploie le site.
Le mode hors connexion (service worker, `public/sw.js`) fonctionne tel quel : Vercel sert le site en HTTPS.

## 1. Base de données : MongoDB Atlas (gratuit)

Vercel ne peut pas joindre la base locale (`127.0.0.1`). Créer une base en ligne :

1. Compte sur <https://www.mongodb.com/cloud/atlas/register>, puis **Create** → cluster **M0 (Free)**,
   fournisseur AWS, région **Frankfurt (eu-central-1)** (même région que le site, `fra1`).
2. **Database Access** → ajouter un utilisateur (nom + mot de passe généré).
3. **Network Access** → **Add IP Address** → `0.0.0.0/0` (Vercel n'a pas d'adresse fixe).
4. **Connect** → **Drivers** → copier l'adresse `mongodb+srv://…`, remplacer `<password>` et ajouter le nom de la base :
   `mongodb+srv://utilisateur:motdepasse@cluster0.xxxxx.mongodb.net/beautyhub?retryWrites=true&w=majority`
5. Charger les données de démonstration depuis l'ordinateur :
   `MONGODB_URI="mongodb+srv://…/beautyhub?…" npm run db:seed`

## 2. Projet Vercel

1. <https://vercel.com/new> → se connecter avec GitHub → importer `Rayen122/glowy`.
2. Framework : Next.js (détecté). Commandes par défaut.
3. Avant **Deploy**, renseigner les variables (section 3). Puis **Settings → Git → Production Branch** :
   la branche à mettre en ligne (par exemple `fix-recette-2026-11-07`, ou `main` après fusion de la PR).

`vercel.json` fixe la région (`fra1`, Francfort, proche de la Tunisie et de la base) et le cron quotidien.

## 3. Variables d'environnement (Settings → Environment Variables)

| Variable | Valeur | Obligatoire |
|---|---|---|
| `MONGODB_URI` | adresse Atlas (étape 1) | oui |
| `AUTH_SECRET` | `openssl rand -base64 32` | oui |
| `AUTH_TRUST_HOST` | `true` | oui |
| `APP_URL` | l'adresse du site, ex. `https://glowy.vercel.app` (à remplir après le 1er déploiement, puis redéployer) | oui |
| `SCHEDULER` | `off` (pas de minuteur sur Vercel : c'est le cron qui appelle `/api/cron`) | oui |
| `CRON_SECRET` | `openssl rand -hex 32` (Vercel l'envoie au cron automatiquement) | oui |
| `GEMINI_API_KEY` | clé Google AI Studio | pour les IA |
| `GROQ_API_KEY` | clé Groq (assistante) | conseillé |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | rendu photoréaliste gratuit de l'essai couleur | conseillé |
| `DEMO_LOGIN` | `true` seulement pour une démonstration (boutons de connexion par rôle) | non |
| `DEMO_LOGIN_PRODUCTION` | `true` **seulement** pour une démo : ouvre le Super Admin sans mot de passe | non |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | envoi réel des e-mails | non |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | notifications push | non |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | connexion Google ; URI de redirection : `https://<site>/api/auth/callback/google` | non |

Ne jamais mettre `MONGODB_URI_TEST` ni `SEED_DEMO_PASSWORD` en ligne (tests et seed locaux seulement).

## 4. Limites du plan gratuit (Hobby)

- **Cron une fois par jour** (8 h, heure de Tunis) : rappels de rendez-vous, expiration des demandes et des points
  passent une fois par jour au lieu de toutes les 10 minutes. Le Super Admin peut lancer `/api/cron` à la main.
- **Limites d'envoi** (`src/infrastructure/rate-limit.ts`) gardées en mémoire de chaque instance : approximatives
  quand Vercel lance plusieurs instances.
- Fonctions limitées à 60 s : suffisant pour le rendu photoréaliste (≈ 3 à 30 s).

## 5. Vérifier après le déploiement

1. Ouvrir le site, se connecter, parcourir les salons.
2. Hors ligne : visiter l'accueil et un salon, couper le réseau (DevTools → Network → Offline), recharger :
   les pages visitées s'affichent, les autres montrent la page « Hors connexion ».
3. Tester l'assistante, l'essai couleur et l'analyse beauté (clés d'IA renseignées).
