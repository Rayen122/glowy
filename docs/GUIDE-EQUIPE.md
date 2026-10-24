# Glowy — Guide d'équipe (débutants Next.js)

> Public : 5 étudiants qui n'ont jamais utilisé Next.js.
> Lire dans l'ordre : sections 1 → 6 ensemble (1 h), puis chacun sa section 9.

## Sommaire

1. [C'est quoi le projet ?](#1-cest-quoi-le-projet-)
2. [Next.js en 10 minutes](#2-nextjs-en-10-minutes)
3. [Lancer le projet](#3-lancer-le-projet)
4. [Architecture du code](#4-architecture-du-code)
5. [GSAP : les animations](#5-gsap--les-animations)
6. [Catalogue des animations du projet](#6-catalogue-des-animations-du-projet)
7. [Règles d'équipe (Git, code, design)](#7-règles-déquipe)
8. [État actuel du projet (à lire !)](#8-état-actuel-du-projet-à-lire-)
9. [Les tâches des 5 personnes](#9-les-tâches-des-5-personnes)
10. [Glossaire et pièges fréquents](#10-glossaire-et-pièges-fréquents)

---

## 1. C'est quoi le projet ?

**Glowy** = plateforme de réservation de salons de beauté vérifiés en **Tunisie** (prix en DT).
Trois langues : **français, arabe (écriture de droite à gauche, RTL), anglais**.

4 types d'utilisateurs :

| Rôle | Ce qu'il fait | Espace |
|---|---|---|
| Client | cherche un salon, réserve, gagne des points, laisse des avis | `/compte` |
| Employé | voit son planning | `/dashboard` |
| Gérant | gère son salon (agenda, stats, équipe) | `/dashboard` |
| Super Admin | valide les salons, modère, gère les utilisateurs | `/admin` |

Chaque personne de l'équipe construit **1 fonctionnalité classique + 1 fonctionnalité IA** (section 9).

Stack technique :

| Outil | Rôle |
|---|---|
| **Next.js 16** (App Router) + **React 19** + **TypeScript** | le site et l'API dans un seul projet |
| **Tailwind CSS 4** + **shadcn/ui** (Base UI) | styles et composants (boutons, dialogues…) |
| **GSAP 3.15** + `@gsap/react` | toutes les animations |
| **Auth.js v5** | connexion / session / rôles |
| **MongoDB 7 + Mongoose 9** | base de données (via Docker) |
| **Zod** | validation des données reçues |
| **Leaflet**, **Recharts** | carte, graphiques |
| PWA + Web Push | installable sur téléphone, notifications |

---

## 2. Next.js en 10 minutes

### 2.1 Next.js = React + un serveur

React seul = une page qui s'affiche dans le navigateur. **Next.js** ajoute : le routage par dossiers, le rendu côté serveur, et des routes API. Tout dans un seul projet.

> ⚠️ **Ce projet utilise Next.js 16, qui diffère de ce que vous trouvez dans les vieux tutoriels.** Avant d'écrire du code sur un sujet Next, lisez la doc locale : `node_modules/next/dist/docs/` (dossiers `01-app`, `03-architecture`…). Un outil d'IA doit aussi la lire (voir `AGENTS.md`).

### 2.2 Le routage = les dossiers

Dans `src/app/`, **un dossier = une URL**. Le fichier `page.tsx` est la page.

```
src/app/(site)/page.tsx                       →  /
src/app/(site)/salons/page.tsx                →  /salons
src/app/(site)/salons/[slug]/page.tsx         →  /salons/salon-yasmine   ([slug] = variable)
src/app/(site)/salons/[slug]/reserver/page.tsx→  /salons/salon-yasmine/reserver
src/app/dashboard/agenda/page.tsx             →  /dashboard/agenda
src/app/api/bookings/route.ts                 →  API : /api/bookings
```

- `(site)` et `(auth)` : les parenthèses = **groupe de dossiers**, ils n'apparaissent **pas** dans l'URL (ils servent à partager un `layout.tsx`).
- `layout.tsx` : enveloppe commune (header, footer, menu) qui reste affichée quand on navigue.
- `template.tsx` : comme un layout mais **recréé à chaque navigation** → on s'en sert pour relancer les animations (section 5).
- `route.ts` : une **route API** (reçoit GET/POST…, renvoie du JSON).
- `proxy.ts` (dans `src/`) : s'exécute avant la page, ici pour rediriger selon le rôle.

### 2.3 Composants serveur vs composants client (le point le plus important)

| | Composant **serveur** (par défaut) | Composant **client** |
|---|---|---|
| Marqueur | rien | `"use client";` en 1re ligne |
| S'exécute | sur le serveur | dans le navigateur |
| Peut | lire la base de données, `async/await` directement | `useState`, `useEffect`, clics, **GSAP** |
| Ne peut pas | `useState`, événements, GSAP | accéder à la base de données |

Règle simple : **une page = composant serveur** qui charge les données, et elle place des **petits composants client** là où il faut de l'interactivité (formulaire, animation, carte).

```tsx
// page.tsx (serveur) — charge les données
export default async function Page() {
  const salons = await listSalons();          // OK : on est sur le serveur
  return <SalonResults salons={salons} />;    // composant client plus bas
}
```

```tsx
// salon-results.tsx (client)
"use client";
export function SalonResults({ salons }) {
  const [filtre, setFiltre] = useState("");   // OK : on est dans le navigateur
  ...
}
```

Un composant client **ne doit jamais importer** de code serveur (`src/modules/*/infrastructure`, `src/server/*`, la base…). Le package `server-only` fait échouer le build si on se trompe.

### 2.4 Les routes API

Un fichier `route.ts` exporte des fonctions nommées `GET`, `POST`, `PATCH`, `DELETE`. Chaque route : (1) vérifie l'utilisateur, (2) valide l'entrée avec **Zod**, (3) appelle la logique métier, (4) répond `{ data }` ou `{ error }`. Détail de tous les points d'entrée : [`docs/API.md`](API.md).

### 2.5 Autres notions utilisées

- **`params` est asynchrone** dans Next 16 : `const { slug } = await params;` (types `PageProps<>`).
- **Navigation** : `<Link href="/salons">` (jamais `<a>`), `useRouter` pour naviguer en code.
- **Langue** : cookie `NEXT_LOCALE` (fr/ar/en), pas de préfixe dans l'URL. Les textes sont dans `src/i18n/dictionaries/{fr,en,ar}.ts` — **`fr.ts` est la référence**, TypeScript signale les clés manquantes dans les autres.
- **Alias d'import** : `@/` = `src/` (ex. `import { gsap } from "@/lib/gsap"`).

---

## 3. Lancer le projet

### 3.1 Prérequis (à installer une fois)

- **Node.js 20+** → `node -v`
- **MongoDB 7+** : soit installé en local (Homebrew / installeur), soit via **Docker Desktop** → `docker -v`
- **Git**
- Éditeur conseillé : VS Code

### 3.2 Première installation

```bash
git clone <url-du-repo> beautyhub && cd beautyhub
npm install
cp -n .env.example .env
```

Puis ouvrir `.env` et renseigner **`AUTH_SECRET`** (obligatoire) :

```bash
openssl rand -base64 32     # copier le résultat dans AUTH_SECRET="..."
```

Variables principales de `.env` :

| Variable | Rôle |
|---|---|
| `MONGODB_URI` | adresse de la base (par défaut `mongodb://127.0.0.1:27017/beautyhub?directConnection=true`) |
| `MONGODB_URI_TEST` | base séparée vidée à chaque test |
| `AUTH_SECRET` | clé de signature des sessions |
| `SEED_DEMO_PASSWORD` | mot de passe commun des comptes de démo |
| `DEMO_LOGIN=true` | boutons « connexion en un clic » sur `/connexion` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | notifications push (laisser vide = désactivé) |

> Ne **jamais** commiter `.env` (il est dans `.gitignore`). On partage seulement `.env.example`.

### 3.3 Chaque jour

```bash
npm run dev       # démarre le site → http://localhost:3000
```

Il faut que **MongoDB tourne** :
- MongoDB installé en local : rien à lancer s'il démarre avec la machine (`brew services start mongodb-community` sur Mac sinon).
- MongoDB via Docker : `npm run db:up` avant, `npm run db:down` après.

Modifier un fichier = la page se recharge toute seule (Hot Reload). Arrêter : `Ctrl+C`.

Première fois (base vide) : `npm run db:seed` pour créer les salons et les comptes de démo.

### 3.4 Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | build de production (détecte les erreurs TypeScript) |
| `npm run start` | lance le build de production |
| `npm run lint` | vérifie le code (ESLint + règles React Compiler) |
| `npm test` | tests automatiques (anti double réservation, fidélité, avis) |
| `npm run db:up` / `db:down` | démarre / arrête MongoDB dans Docker (inutile si MongoDB est installé) |
| `npm run db:seed` | vide et remplit la base avec les données de démo |
| `npx tsc --noEmit` | vérifie les types sans construire |

### 3.5 Comptes de démonstration

Après le seed, mot de passe = `SEED_DEMO_PASSWORD` :

| Rôle | E-mail | Redirigé vers |
|---|---|---|
| Cliente | `sarra@beautyhub.tn` | `/compte` |
| Gérante | `yasmine@beautyhub.tn` | `/dashboard` |
| Employée | `nour@beautyhub.tn` | `/dashboard` |
| Super Admin | `admin@beautyhub.tn` | `/admin` |

### 3.6 Que se passe-t-il quand on lance `npm run dev` ?

1. Next lit `next.config.ts` et `.env`.
2. Il compile **à la demande** la page visitée (pas tout le projet).
3. Requête vers `/dashboard` → `src/proxy.ts` lit le cookie de session → redirige vers `/connexion` si absent ou mauvais rôle.
4. `src/app/layout.tsx` (racine : polices, `I18nProvider`, `Toaster`, PWA) enveloppe `dashboard/layout.tsx`, qui enveloppe `template.tsx` → `MotionRoot` → la page.
5. La page serveur lit la base (Mongoose) et envoie le HTML ; le navigateur « hydrate » les composants client ; **GSAP démarre** (section 5).

---

## 4. Architecture du code

### 4.1 Vue d'ensemble

```
src/
├─ app/                  ROUTES (pages + API) — le moins de logique possible ici
│  ├─ (site)/            site public + espace client (/salons, /compte, /pro, /analyse-beaute)
│  ├─ (auth)/            /connexion, /inscription
│  ├─ dashboard/         espace gérant / employé
│  ├─ admin/             espace Super Admin
│  ├─ api/               routes API (bookings, salons, reviews, admin, me…)
│  ├─ layout.tsx         layout racine (polices, i18n, PWA)
│  └─ globals.css        thème Tailwind, couleurs, règles d'animation CSS
├─ components/           composants React réutilisables (voir 4.3)
├─ modules/              LOGIQUE MÉTIER, un dossier par domaine (voir 4.2) : identity, booking, catalog,
│                        loyalty, reviews, notifications, admin, dashboard, account
├─ core/domain/          briques communes : erreurs, heure, événements, acteur
├─ infrastructure/       technique partagée : base MongoDB, bus d'événements, HTTP, session
├─ i18n/                 traductions + formatage (dates, nombres) fr / en / ar
├─ lib/                  utilitaires : api.ts (appels API côté client), data.ts (données de démo), gsap.ts, utils.ts
├─ auth.ts, auth.config.ts   configuration Auth.js
├─ proxy.ts              redirection par rôle
tests/                   tests automatiques (node:test)
design-system/MASTER.md  règles de design (couleurs, typo, animations) — LIRE
docs/API.md              documentation des routes API
```

### 4.2 Clean Architecture dans `src/modules/`

Chaque module (`identity`, `booking`, `loyalty`, `reviews`, `notifications`, `admin`) a 3 couches. **Les dépendances vont toujours vers le centre** :

```
infrastructure  →  application  →  domain
(Mongo, e-mail)    (cas d'usage)    (règles pures)
```

| Couche | Contenu | Exemple (booking) |
|---|---|---|
| `domain/` | règles pures, **sans** base ni framework | `availability.ts` (calcul des créneaux), `policy.ts` (règles d'annulation) |
| `application/` | cas d'usage + `ports.ts` (interfaces) + `schemas.ts` (Zod) | `use-cases.ts` : réserver, annuler, reporter |
| `infrastructure/` | implémentation concrète avec Mongoose | `mongo-booking-repository.ts`, `slot-locks.ts` |

Pourquoi ? Pour pouvoir **tester** la règle métier sans base de données, et changer de base sans réécrire la logique (c'est exactement ce qui arrive avec la migration Postgres → MongoDB).

### 4.3 Dossier `components/`

| Dossier | Contenu |
|---|---|
| `ui/` | briques shadcn (button, dialog, tabs, select…) — **ne pas modifier sans accord** |
| `motion/` | **animations GSAP partagées** : `motion-root`, `hero-motion`, `tilt-card` |
| `auth/` | scène animée de connexion (`auth-stage`, `auth-card`) |
| `booking/` | tunnel de réservation |
| `salon/` | carte salon, carte Leaflet, favoris, résultats |
| `dashboard/`, `admin/`, `account/`, `loyalty/` | éléments d'espaces |
| `charts/` | graphiques (heatmap d'affluence, barres, aires) |
| `ai/` | chatbot, analyse beauté |
| `site/`, `app-shell/` | header, footer, navigation, coquille d'application |
| `i18n/`, `pwa/`, `brand/` | sélecteur de langue, PWA, logo |

### 4.4 Événements entre modules

Un module **émet** un événement (`booking.completed`, `review.published`…) ; d'autres modules **réagissent** via des abonnés (`src/modules/subscribers.ts`). Exemple : une réservation terminée → le module fidélité crédite des points, le module notifications envoie une alerte. **Pour ajouter une réaction : ajouter un abonné, sans toucher au module émetteur.**

### 4.5 Sécurité et règles métier clés

- **Anti double réservation** : collection `SlotLock` (tranches de 5 min) + index unique → 10 réservations simultanées du même créneau = une seule acceptée (test dans `tests/booking.test.ts`).
- **Contrôle d'accès** : `proxy.ts` (rapide, par cookie) **et** vérification définitive dans chaque page / route API. Un gérant ne voit que son salon.
- **Dates** : stockées en UTC, affichées en heure de Tunis.
- **Points de fidélité** : crédités uniquement après un RDV **terminé par le salon**.
- **CSRF** : les écritures venant d'une autre origine sont refusées. Mots de passe hachés (bcrypt), blocage après 5 échecs.

### 4.6 Données mock

`src/lib/data.ts` contient les images, catégories, plans et salons de démonstration : il alimente le seed (`npm run db:seed`) et les visuels de présentation. Toutes les pages lisent leurs données dans la base MongoDB.

---

## 5. GSAP : les animations

### 5.1 C'est quoi GSAP ?

**GSAP** (GreenSock Animation Platform) = bibliothèque JavaScript qui anime n'importe quoi : position, opacité, taille, couleur, SVG, nombres… Plus fluide et plus puissante que les animations CSS : séquences, scroll, contrôle total (pause, inverser, accélérer).

Concepts à retenir (5 mots) :

| Mot | Sens |
|---|---|
| **Tween** | une animation d'un élément (`gsap.to`, `from`, `fromTo`, `set`) |
| **Timeline** | une séquence de tweens placés dans le temps |
| **Easing** | la « courbe » de vitesse (`power3.out` = démarre vite, finit doucement) |
| **ScrollTrigger** | déclenche ou lie une animation au scroll |
| **SplitText** | découpe un texte en lignes/mots/lettres pour les animer |

### 5.2 Les 4 méthodes de base

```ts
gsap.to(el,     { opacity: 1, y: 0, duration: 0.8 });          // va vers cet état
gsap.from(el,   { opacity: 0, y: 40 });                         // part de cet état vers l'état actuel
gsap.fromTo(el, { opacity: 0 }, { opacity: 1 });                // départ ET arrivée explicites
gsap.set(el,    { opacity: 0 });                                // applique tout de suite, sans animation
```

Propriétés utiles : `x`, `y` (px), `xPercent`, `yPercent`, `scale`, `rotation`, `autoAlpha` (= `opacity` + `visibility`), `clipPath`, `stagger` (décalage entre plusieurs éléments), `delay`, `repeat: -1` (infini), `yoyo: true` (aller-retour).

### 5.3 Timeline

```ts
const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
tl.fromTo(".badge", { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0 }, 0.05)  // à 0,05 s
  .fromTo(".lead",  { autoAlpha: 0 },        { autoAlpha: 1 },        0.6);  // à 0,6 s
```

Le dernier nombre est la **position** dans la timeline. Exemple réel : `src/components/motion/hero-motion.tsx`.

### 5.4 ScrollTrigger (animations au scroll)

```ts
gsap.from(el, {
  y: 60, autoAlpha: 0,
  scrollTrigger: { trigger: el, start: "top 90%", once: true },  // quand le haut de l'élément atteint 90 % de l'écran
});
```

`scrub: 0.6` lie l'animation à la position de scroll (parallaxe).

### 5.5 GSAP dans React / Next.js — les règles

1. **Toujours dans un composant client** (`"use client"`). GSAP touche le DOM, impossible côté serveur.
2. **Toujours importer depuis `@/lib/gsap`**, jamais depuis `"gsap"` directement. Ce fichier enregistre une seule fois les plugins (`ScrollTrigger`, `SplitText`, `useGSAP`) et fixe les valeurs par défaut (`power3.out`, 0,8 s) :

   ```ts
   import { gsap, MOTION_OK, ScrollTrigger, SplitText, useGSAP } from "@/lib/gsap";
   ```

3. **Utiliser le hook `useGSAP`** (pas `useEffect`) : il nettoie automatiquement les animations quand le composant disparaît. On lui donne un `scope` (le conteneur) pour que les sélecteurs ne ciblent que l'intérieur :

   ```tsx
   "use client";
   import { useRef } from "react";
   import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";

   export function MaCarte({ children }: { children: React.ReactNode }) {
     const ref = useRef<HTMLDivElement>(null);

     useGSAP(() => {
       const mm = gsap.matchMedia();
       mm.add(MOTION_OK, () => {                       // seulement si l'utilisateur accepte les animations
         gsap.from(ref.current, { autoAlpha: 0, y: 30 });
       });
       return () => mm.revert();                       // nettoyage
     }, { scope: ref });

     return <div ref={ref}>{children}</div>;
   }
   ```

4. **`MOTION_OK` + `gsap.matchMedia()`** = respecter « réduire les animations » (accessibilité). Sans ça, on est refusé en revue de code.
5. Pour un clic/événement : envelopper la fonction avec `contextSafe` (fourni par `useGSAP`) pour qu'elle soit nettoyée aussi.
6. **N'animer que `transform` et `opacity`** (`x`, `y`, `scale`, `autoAlpha`) + `clip-path` pour les images → 60 fps. Jamais `width`, `height`, `top`, `left` (provoque des recalculs de mise en page).
7. Durées 0,4–1,2 s. Pas d'animation décorative qui bloque l'utilisateur.

### 5.6 Le système déclaratif `data-animate` (le plus utile au quotidien)

Pour animer sans écrire de GSAP : **poser un attribut HTML** sur un élément d'une page serveur. Le composant `MotionRoot` (`src/components/motion/motion-root.tsx`) trouve ces attributs et crée les animations.

```tsx
<h1 data-animate="split">Trouvez votre salon</h1>
<div data-animate="stagger" data-stagger="0.1">
  <Card/> <Card/> <Card/>        {/* apparaissent en cascade */}
</div>
<p data-animate="count">12 860</p>
```

| Attribut | Effet |
|---|---|
| `data-animate="fade-up"` | monte en fondu quand il entre dans l'écran |
| `data-animate="stagger"` (+ `data-stagger="0.1"`) | les **enfants** apparaissent en cascade |
| `data-animate="split"` | titre révélé mot par mot (SplitText) |
| `data-animate="count"` | nombre compté depuis 0 — **élément texte seul, sans enfants** |
| `data-animate="grow-x"` / `"grow-y"` | barre qui se remplit / barres qui montent |
| `data-animate="pop"` | apparition avec léger rebond |
| `data-animate="clip"` | image dévoilée de bas en haut |
| `data-speed="-8"` | parallaxe pendant le scroll |

**Comment ça marche** : `template.tsx` de `(site)`, `dashboard` et `admin` enveloppe la page dans `<MotionRoot>`. À chaque navigation, `MotionScope` appelle `initAll()` qui, pour chaque type d'attribut : cache les éléments (`gsap.set`), puis les révèle avec un `ScrollTrigger`. Il gère aussi la transition de page (fondu) et les nombres selon la langue (12 860 · 12,860 · 12.860).

**À ne jamais faire** : mettre `data-animate` dans le **header, le footer, un onglet, ou un bloc monté plus tard côté client** → l'élément resterait **invisible pour toujours** (le CSS le cache jusqu'à ce que `MotionRoot` le prenne en charge).

### 5.7 Accessibilité et robustesse

- `prefers-reduced-motion: reduce` → rien n'est caché ni animé (CSS dans `globals.css` + `matchMedia`).
- `<noscript>` : tout reste visible sans JavaScript.
- **Changement de langue** : l'interface fait `router.refresh()`. Tout composant dont GSAP/SplitText modifie le DOM doit être **keyé par la locale** (`key={locale}`), sinon conflit React/DOM. `MotionRoot`, `AuthStage`, `AuthCard` le font déjà.
- **Arabe** : jamais de `SplitText` par lettres (les lettres arabes se lient), `letter-spacing` normal, `transformOrigin` inversé pour `grow-x` en RTL (déjà géré).
- Dans une timeline **qui se répète**, un `fromTo` qui ne doit pas cacher la 1re image prend `immediateRender: false`.
- Le navigateur intégré à certains outils tourne à ~2 fps : les animations y semblent bloquées. Tester dans un vrai Chrome/Safari.

---

## 6. Catalogue des animations du projet

| Où | Fichier | Ce qui est animé | Techniques |
|---|---|---|---|
| Toutes les pages | `components/motion/motion-root.tsx` | fondu de page, apparitions au scroll, compteurs, barres, parallaxe | ScrollTrigger (`batch`, `scrub`), SplitText, `matchMedia` |
| Accueil (hero) | `components/motion/hero-motion.tsx` | titre mot par mot, badge, arche dévoilée, cartes qui flottent en boucle | timeline, SplitText `mask: "lines"`, `yoyo`/`repeat: -1` |
| Carte fidélité | `components/motion/tilt-card.tsx` | inclinaison 3D qui suit la souris | `quickTo`, `transformPerspective`, `(hover: hover)` |
| Connexion / inscription | `components/auth/auth-stage.tsx` | scène sombre : orbes, puces qui flottent, mots qui défilent, accélération à la validation | timeline en boucle, `timeScale` |
| Carte de connexion | `components/auth/auth-card.tsx` | entrée du titre et des champs | timeline, SplitText |
| Formulaires | `components/site/auth-forms.tsx` | secousse sur erreur, sortie en douceur à la réussite | `keyframes`, `contextSafe` |
| Tunnel de réservation | `components/booking/booking-flow.tsx` | glissement entre étapes | `fromTo` + `clearProps` |
| Heatmap d'affluence | `components/charts/affluence-heatmap.tsx` | vague sur les cellules | `stagger` |
| Analyse beauté | `components/ai/beauty-analysis.tsx` | résultats en cascade | `from` + `stagger` |
| CSS (hors GSAP) | `globals.css` | flottement `--animate-float`, état caché avant GSAP | keyframes CSS |

**Exercice de démarrage (30 min)** : ouvrir `hero-motion.tsx`, changer `duration: 1.15` du titre à `2`, sauvegarder et regarder `/` dans le navigateur. Puis remettre.

---

## 7. Règles d'équipe

### 7.1 Git

- Branche principale : `main` (protégée : on ne pousse **jamais** directement).
- Une branche par tâche : `p1/auth-reco`, `p3/chatbot`, etc.
- Cycle quotidien :

  ```bash
  git checkout main && git pull
  git checkout -b p3/recherche-filtres
  # ... travail ...
  git add <fichiers>          # éviter git add . sans regarder
  git commit -m "feat(search): filtre par catégorie"
  git push -u origin p3/recherche-filtres
  # puis Pull Request sur GitHub, 1 relecteur minimum
  ```

- Messages : `feat(...)`, `fix(...)`, `docs(...)`, `refactor(...)`, `test(...)`.
- Petites PR (< 400 lignes si possible). **Avant la PR** : `npm run lint`, `npx tsc --noEmit`, `npm test`.
- Fichiers « chauds » où les conflits sont probables — prévenir l'équipe avant de les modifier : `src/lib/data.ts`, `src/i18n/dictionaries/*.ts`, `src/app/globals.css`, `src/infrastructure/db/models.ts`, `package.json`.

### 7.2 Code

- TypeScript strict : pas de `any`. Valider toute entrée API avec **Zod**.
- Composant serveur par défaut ; `"use client"` seulement si nécessaire et le plus bas possible dans l'arbre.
- Aucun texte en dur : tout passe par les dictionnaires `src/i18n/dictionaries/` (**fr, en, ar** en même temps).
- ESLint React Compiler strict : pas de `setState` synchrone dans `useEffect`, pas de `Date.now()` dans le rendu (calculer l'heure dans un helper serveur).
- Un composant shadcn/Base UI n'a **pas** de prop `asChild` : pour un lien-bouton, utiliser `buttonVariants` sur un `<Link>`.

### 7.3 Design (lire `design-system/MASTER.md`)

- Couleurs : prune `#6B2A5C` sur ivoire `#FBF7F4`, thème clair uniquement. Police : Plus Jakarta Sans (+ IBM Plex Sans Arabic en RTL).
- Icônes **Lucide uniquement**, jamais d'emoji. Cibles tactiles ≥ 44 px, focus visible.
- Propriétés CSS logiques pour le RTL : `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-` (pas `ml-`/`mr-`). Flèches : `rtl:rotate-180`.
- **Même contenu sur téléphone et PC** : ne jamais cacher du contenu PC sur mobile — l'adapter. Tester à 375, 768, 1024, 1280 px.
- Sur téléphone, champs de saisie en `text-base` (16 px) pour éviter le zoom iOS.
- Une barre fixe en bas d'écran doit porter l'attribut `data-bottom-bar` et utiliser `env(safe-area-inset-*)`.

### 7.4 Pièges connus

- Tuiles de carte : utiliser `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (CARTO demande une clé).
- Un tableau avec `sr-only` ne se masque pas : l'envelopper dans `<div className="sr-only">`.
- `lucide-react` v1 n'a plus les logos de marques : utiliser du SVG inline.
- Après `signIn` Auth.js : `window.location.assign()`, pas `router.push()`.

---

## 8. État actuel du projet (à lire !)

| Sujet | État |
|---|---|
| **Base de données** | **MongoDB + Mongoose**, migration terminée (octobre 2026). Modèles : `src/infrastructure/db/models.ts`. |
| **Architecture** | tous les modules (`identity`, `admin`, `platform`, `booking`, `catalog`, `assistant`, `dashboard`, `promotions`, `affluence`, `reviews`, `support`, `account`, `loyalty`, `notifications`, `subscription`, `beauty`, `media`) suivent `domain` → `application` → `infrastructure`. L'ancien dossier `src/server` et Prisma ont été retirés. |
| **Données de démo** | `npm run db:seed` fonctionne (`scripts/seed.ts`). |
| **Tests** | `npm test` : 73 tests (réservation, anti double réservation, fidélité, avis, admin, dashboard, IA…) sur la base `MONGODB_URI_TEST`. |
| **IA** | **les 5 IA sont intégrées** (recommandation, affluence, assistante, analyse des avis, analyse photo) : fonctions pures testées, sans service externe, avec repli. Voir [`GESTIONS.md`](GESTIONS.md). |
| **Stats du dashboard** | réelles, calculées depuis la base, export Excel / PDF. |
| **PWA** | installable (manifest), hors connexion (service worker `public/sw.js`, à essayer avec `npm run build && npm start`). |
| **Reste à faire côté architecture** | règles ESLint qui interdisent les imports entre couches, tests unitaires du `domain`, `docs/ARCHITECTURE.md`. |

> Chacun peut travailler directement sur sa partie avec la vraie base (données de démo fournies par le seed).

---

## 9. Les tâches des 5 personnes

> **La répartition de référence est [`REPARTITION.md`](REPARTITION.md)**, établie à partir du cahier des charges (exigences, priorités, état, dossiers possédés). Elle prime sur les résumés ci-dessous, qui n'incluent pas tout le périmètre du cahier (par exemple : support pour P4, paiement et abonnements pour P5).

Chaque personne = **1 tâche classique + 1 fonctionnalité IA**. Les fonctionnalités ci-dessous sont aujourd'hui construites (état détaillé : [`GESTIONS.md`](GESTIONS.md)) : chacun doit connaître le code de sa partie et savoir la présenter (démo de validation : [`VALIDATION-S8.md`](VALIDATION-S8.md)).

### 9.0 Prise en main (semaine 1, tous ensemble)

Le socle technique est terminé (MongoDB, modules, auth, seed, tests). Chacun doit d'abord :

1. Lancer le projet, se connecter avec les 4 comptes de démo (section 3.5).
2. Faire `npm test` (73 tests verts) et `npm run lint`.
3. Lire le module de sa tâche en suivant le chemin d'une requête : page → route API → `application/use-cases.ts` → `infrastructure/`.
4. Faire l'exercice GSAP de la section 6.

---

### Personne 1 — Authentification, administration + IA de recommandation

**Pages/fichiers** : `src/app/(auth)/*`, `src/auth.ts`, `src/auth.config.ts`, `src/proxy.ts`, `src/modules/identity`, `src/modules/admin`, `src/app/admin/*`, `src/app/api/auth/*`, `src/app/api/admin/*`, `src/components/auth/*`, `src/components/admin/admin-queues.tsx`.

**Tâche classique**
1. Terminer inscription / connexion client et salon (Zod, bcrypt, blocage après 5 échecs).
2. Rôles et accès : `proxy.ts` + contrôle serveur dans chaque page admin.
3. Admin : file de validation des salons, gestion des utilisateurs (bloquer/débloquer), vue globale, journal d'audit.
4. Mot de passe oublié / réinitialisation (si dans le cahier).

**IA — Recommandation de salons**
- Entrée : historique de réservations, favoris, catégories, localisation du client. Sortie : liste classée avec une raison courte (« parce que vous avez aimé… »).
- Étapes : (a) fonction de score pure dans `modules/*/domain` (testable) — distance, note, catégories préférées, popularité ; (b) route `GET /api/me/recommendations` ; (c) brancher le bloc « Recommandé pour vous » de l'accueil ; (d) option : appel à un LLM pour reformuler la raison.

**GSAP** : affiner la scène de `auth-stage.tsx` ; animer l'arrivée des cartes de reco avec `data-animate="stagger"`.
**Terminé quand** : les 4 rôles se connectent et sont redirigés correctement ; un test couvre le blocage après 5 échecs ; la reco change selon le client.

---

### Personne 2 — Dashboard du salon + IA de prédiction d'affluence

**Pages/fichiers** : `src/app/dashboard/*` (dont `agenda`), `src/app/api/dashboard/*`, `src/components/dashboard/*`, `src/components/charts/*`.

**Tâche classique**
1. Vue du jour : RDV par employé, statut (confirmé / terminé / annulé / absent), actions rapides.
2. Agenda semaine/jour avec filtre par employé (couleur + nom, jamais la couleur seule).
3. Gestion de l'équipe, des prestations, des horaires et fermetures.
4. Statistiques réelles (CA, RDV par jour, top prestations) à la place des 30 jours simulés ; périmètre : **un gérant ne voit que son salon**.

**IA — Prédiction d'affluence**
- Entrée : historique des réservations par jour/heure. Sortie : niveau d'affluence prévu (heatmap + prévision des prochains jours) affiché aussi sur la fiche salon.
- Étapes : (a) agréger les réservations par créneau (moyenne mobile par jour de semaine + heure) dans `domain` ; (b) route `GET /api/salons/[slug]/affluence` ; (c) brancher `affluence-heatmap.tsx` et `forecast-bars.tsx` ; (d) afficher « moment calme » pour guider le client.

**GSAP** : la vague de `affluence-heatmap.tsx`, `data-animate="grow-y"` sur les barres, `data-animate="count"` sur les chiffres clés.
**Terminé quand** : le dashboard lit la vraie base, un employé ne voit pas les autres salons, la prévision se base sur de vraies réservations.

---

### Personne 3 — Recherche, réservation + chatbot IA

**Pages/fichiers** : `src/app/(site)/salons/*`, `src/app/api/salons/*`, `src/app/api/bookings/*`, `src/modules/booking`, `src/components/booking/*`, `src/components/salon/*`, `src/components/site/search-bar.tsx`, `src/components/ai/chatbot-widget.tsx`.

**Tâche classique**
1. Recherche + filtres (catégorie, ville, prix, note, ouvert maintenant) + carte Leaflet synchronisée avec la liste.
2. Fiche salon (prestations, équipe, avis, horaires).
3. Tunnel de réservation : prestation → employé → créneau (calcul `availability.ts`) → confirmation.
4. Annulation / report selon `policy.ts` ; **anti double réservation** (test existant dans `tests/booking.test.ts` à garder vert).

**IA — Chatbot**
- Il répond en FR/AR/EN, aide à trouver un salon, propose des créneaux, redirige vers la réservation.
- Étapes : (a) route `POST /api/chat` qui appelle le LLM avec un prompt système + des **outils** (rechercher salons, lire créneaux) — le bot ne doit lire que des données publiques ; (b) brancher `chatbot-widget.tsx` ; (c) garde-fous : limite de débit, pas de données personnelles, repli si l'API LLM échoue.

**GSAP** : transitions d'étapes de `booking-flow.tsx` ; ouverture/fermeture animée du chatbot (`contextSafe`).
**Terminé quand** : on réserve de bout en bout depuis un téléphone (375 px) ; 10 réservations simultanées = 1 acceptée ; le chatbot répond dans les 3 langues.

---

### Personne 4 — Avis, modération + IA d'analyse des avis

**Pages/fichiers** : `src/modules/reviews`, `src/app/api/reviews/*`, section avis de `/salons/[slug]`, modération dans `src/app/admin/[module]` (avec P1), `src/components/admin/admin-queues.tsx`.

**Tâche classique**
1. Avis vérifiés : seulement après un RDV **terminé** ; une note + commentaire + prestation.
2. Réponse du salon, signalement d'un avis, file de modération côté admin (publier / masquer / supprimer), journal d'audit.
3. Affichage : tri, moyenne, répartition des notes.
4. Événement `review.published` → recalcul de la note du salon et notification.

**IA — Analyse des avis**
- Entrée : texte des avis d'un salon. Sortie : résumé en 2–3 phrases, points forts / points faibles, sentiment ; aide à repérer les avis toxiques ou suspects pour la modération.
- Étapes : (a) fonction `summarizeReviews(salonId)` ; (b) mise en cache du résumé (le recalculer seulement quand de nouveaux avis arrivent) ; (c) badge « Résumé IA » sur la fiche salon ; (d) score de toxicité qui pré-remplit la file de modération (la décision reste **humaine**).

**GSAP** : `data-animate="stagger"` sur la liste d'avis, `data-animate="grow-x"` sur la répartition des notes.
**Terminé quand** : impossible de noter sans RDV terminé (test) ; le résumé IA s'affiche et se met à jour ; la modération fonctionne.

---

### Personne 5 — Espace client, fidélité + IA d'analyse photo

**Pages/fichiers** : `src/app/(site)/compte/*` (rendez-vous, fidélité, favoris), `src/app/(site)/pro`, `src/app/(site)/analyse-beaute`, `src/app/api/me/*`, `src/modules/loyalty`, `src/modules/notifications`, `src/components/loyalty/*`, `src/components/account/*`, `src/components/ai/beauty-analysis.tsx`, `src/components/pwa/*`.

**Tâche classique**
1. Espace client : mes RDV (à venir / passés, annuler, reporter), profil, favoris.
2. Fidélité : points crédités par `award()` à la fin d'un RDV, niveaux, récompenses échangeables (`/api/me/loyalty/redeem`), barème modifiable.
3. Notifications : centre de notifications dans l'application + Web Push (clés VAPID).
4. PWA : installation, page `/offline`, icônes (`scripts/generate-pwa-icons.mjs`). Page `/pro` (offre et tarifs des salons).

**IA — Analyse photo (« analyse beauté »)**
- Entrée : photo du visage/cheveux. Sortie : type de peau/cheveux, conseils, prestations recommandées avec lien de réservation.
- Étapes : (a) upload sécurisé (type et taille limités, pas de stockage inutile) ; (b) route `POST /api/beauty-analysis` vers un modèle de vision ; (c) rendu dans `beauty-analysis.tsx` ; (d) **consentement explicite** (données sensibles) et message « conseil indicatif, pas un avis médical ».

**GSAP** : `TiltCard` sur la carte fidélité ; `data-animate="count"` sur les points ; cascade des résultats dans `beauty-analysis.tsx`.
**Terminé quand** : points crédités uniquement à un RDV terminé (test `loyalty-reviews.test.ts`) ; notification reçue sur mobile ; l'analyse photo renvoie des conseils cohérents.

---

### 9.1 Planning conseillé (6 semaines)

| Semaine | Tout le monde |
|---|---|
| 1 | Lecture du guide, installation, exercice GSAP, **prise en main 9.0** |
| 2 | Tâches classiques : fonctionnalités principales sur la vraie base |
| 3 | Tâches classiques : finitions, tests, i18n fr/en/ar |
| 4 | Fonctionnalités IA (version simple puis améliorée) |
| 5 | Animations, responsive (375 / 768 / 1024 / 1280), accessibilité |
| 6 | Intégration, `npm run build`, correction de bugs, démo, rapport |

Point d'équipe de 15 min deux fois par semaine : « fait / bloqué / prochain ».

---

## 10. Glossaire et pièges fréquents

| Terme | Définition |
|---|---|
| **App Router** | système de routage de Next par dossiers `app/` |
| **SSR / composant serveur** | page construite sur le serveur avant envoi |
| **Hydratation** | le navigateur rend le HTML interactif |
| **Hook** | fonction React `useXxx` (`useState`, `useRef`, `useGSAP`) |
| **Zod** | bibliothèque de validation de données |
| **Mongoose** | bibliothèque pour parler à MongoDB |
| **Replica set** | MongoDB en mode « cluster » (même à 1 nœud) : nécessaire aux transactions |
| **Seed** | script qui remplit la base de données de démo |
| **RTL** | right-to-left, sens de lecture de l'arabe |
| **PWA** | site installable comme une application |
| **Tween / Timeline** | animation GSAP / séquence d'animations |

**Pièges fréquents**

| Symptôme | Cause probable |
|---|---|
| `useState only works in a Client Component` | oubli de `"use client"` |
| Un élément reste invisible | `data-animate` dans un header/footer/onglet, ou JS planté (voir console) |
| `document is not defined` / `window is not defined` | code navigateur (GSAP…) exécuté côté serveur |
| Erreur de connexion MongoDB | MongoDB n'est pas démarré (service local, ou `npm run db:up` avec Docker) |
| `AUTH_SECRET` manquant / session invalide | `.env` non renseigné |
| Animation qui « saute » après changement de langue | composant animé non keyé par `locale` |
| Texte arabe coupé en lettres | `SplitText` par `chars` en arabe |
| Page blanche après modif | regarder le terminal `npm run dev` puis la console du navigateur |

**Où chercher de l'aide** : `design-system/MASTER.md` (design + animations), `docs/API.md` (routes), `node_modules/next/dist/docs/` (Next 16), https://gsap.com/docs (GSAP), `docs/REPARTITION.md` (exigences du cahier par personne).
