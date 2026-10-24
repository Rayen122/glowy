# Glowy

Plateforme de réservation de salons de beauté vérifiés en Tunisie (projet d'équipe, 5 personnes).
Monolithe modulaire **Next.js 16** (App Router, TypeScript) — interface FR / AR (RTL) / EN, base **MongoDB + Mongoose**, authentification **Auth.js v5**.

- **Guide d'équipe (débutants Next.js, GSAP, tâches de chacun)** : [`docs/GUIDE-EQUIPE.md`](docs/GUIDE-EQUIPE.md)
- **Répartition du projet en 5 personnes (dossiers de chacun)** : [`docs/REPARTITION.md`](docs/REPARTITION.md)
- Design system et règles d'interface : [`design-system/MASTER.md`](design-system/MASTER.md)
- Documentation des API : [`docs/API.md`](docs/API.md)

## Installation

Prérequis : Node.js 20+ et MongoDB 7+ (installé en local, ou Docker, ou MongoDB Atlas).

```bash
npm install
cp -n .env.example .env     # -n : n'écrase jamais un .env existant ; puis renseigner AUTH_SECRET (openssl rand -base64 32)
npm run db:seed             # données de démonstration (vide puis remplit la base)
npm run dev                 # http://localhost:3000
```

MongoDB : `MONGODB_URI` pointe par défaut sur `mongodb://127.0.0.1:27017/beautyhub`.
- **MongoDB installé en local** (Homebrew, installeur) : rien d'autre à faire, il doit simplement tourner.
- **Docker** : `npm run db:up` démarre un MongoDB avec replica set (`docker-compose.yml`) ; `npm run db:down` l'arrête.
- Les transactions exigent un replica set ; sans replica set (MongoDB autonome), le code s'en passe et les opérations critiques restent protégées par des index uniques et des mises à jour atomiques.

### Comptes de démonstration

Créés par `npm run db:seed`, mot de passe commun `SEED_DEMO_PASSWORD` (voir `.env.example`) :

| Rôle        | E-mail                 | Espace       |
| ----------- | ---------------------- | ------------ |
| Cliente     | `sarra@beautyhub.tn`   | `/compte`    |
| Gérante     | `yasmine@beautyhub.tn` | `/dashboard` |
| Employée    | `nour@beautyhub.tn`    | `/dashboard` |
| Super Admin | `admin@beautyhub.tn`   | `/admin`     |

Avec `DEMO_LOGIN=true`, la page de connexion propose aussi une connexion en un clic par rôle (à désactiver hors démonstration).

## Scripts

| Commande              | Rôle                                                              |
| --------------------- | ----------------------------------------------------------------- |
| `npm run dev`         | Serveur de développement                                          |
| `npm run build`       | Build de production                                               |
| `npm run lint`        | ESLint (règles React Compiler)                                    |
| `npm test`            | Tests automatisés sur la base de test (`MONGODB_URI_TEST`)        |
| `npm run db:seed`     | Vide et remplit la base avec les données de démonstration         |
| `npm run db:up`       | Démarre MongoDB avec Docker (inutile si MongoDB est déjà installé) |
| `npm run db:down`     | Arrête le MongoDB Docker                                          |

## Architecture

Clean Architecture par module (`domain` → `application` → `infrastructure`), détail dans le guide d'équipe.

```
scripts/seed.ts          données de démonstration
src/
  app/                   pages et routes API (validation Zod, réponses { data } / { error })
  auth.config.ts, auth.ts, proxy.ts   Auth.js (rôles, blocage après 5 échecs) et redirections par rôle
  core/domain/           noyau commun : erreurs, heure de Tunis, événements, horloge
  infrastructure/        base MongoDB (db/), bus d'événements, helpers HTTP, session
  modules/               un dossier par domaine : identity, booking, catalog, loyalty,
                         reviews, notifications, admin, dashboard, account
tests/                   tests node:test (anti double réservation, fidélité, avis, admin)
```

### Règles importantes

- **Anti double réservation (RES-04)** : collection `SlotLock` (une ligne par tranche de 5 minutes et par employé) avec index unique. Test : 10 réservations simultanées du même créneau → une seule acceptée.
- **Événements** : un module émet (`booking.completed`, `review.published`…) et les abonnés déclarés dans `src/modules/subscribers.ts` réagissent. Pour ajouter une réaction, ajouter un abonné : ne pas modifier le module émetteur.
- **Points de fidélité** : crédités uniquement après un rendez-vous **terminé par le salon** (grand livre `PointTransaction`). Barème réglable dans la collection `PointRule`.
- **Sécurité** : chaque route API appelle `requireUser(...)` ; les écritures venant d'une autre origine sont refusées (CSRF) ; mots de passe hachés avec bcrypt ; actions sensibles journalisées dans `AuditLog`.
- **Dates** : stockées en UTC, saisies et affichées en heure de Tunis (`src/core/domain/time.ts`).
- **E-mails** (mot de passe oublié, vérification, rappels) : envoyés pour de vrai dès que `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` sont renseignés dans `.env` (Gmail : mot de passe d'application, voir `.env.example`), sinon simulés et visibles par le Super Admin dans « Messages envoyés ». En production, renseigner aussi `APP_URL` (adresse des liens envoyés). Les SMS restent simulés.
- **Hors connexion (PWA)** : le service worker `public/sw.js` garde les pages consultées (et précharge les pages publiques liées) avec leurs fichiers ; sans réseau, elles s'ouvrent depuis l'appareil, sinon la page `/offline` liste celles qui sont disponibles. Les pages personnelles sont effacées à la déconnexion. Actif seulement en production : pour essayer, `npm run build && npm start`, puis couper le réseau (DevTools > Network > Offline).
- **IA** : les 5 IA (recommandation, prédiction d'affluence, assistante de réservation, analyse des avis, analyse photo) sont intégrées, sans service externe : fonctions pures testées, avec repli. Détail : [`docs/GESTIONS.md`](docs/GESTIONS.md).
- **Données de démonstration** : `src/lib/data.ts` (images, catégories, plans, salons de démo) alimente le seed (`npm run db:seed`) et les visuels de présentation ; tout le reste vient de la base.

## Ajouter une fonctionnalité

1. Modifier le modèle dans `src/infrastructure/db/models.ts`.
2. Écrire la règle métier dans `src/modules/<module>/domain`, le cas d'usage dans `application` (validation Zod), l'accès base dans `infrastructure`.
3. Exposer une route dans `src/app/api/.../route.ts` avec `route()`, `requireUser()` et `readJson()`.
4. Ajouter un test dans `tests/` et les textes dans les trois dictionnaires `src/i18n/dictionaries/`.
