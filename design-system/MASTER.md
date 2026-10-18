# Glowy — Design System (MASTER)

Source de vérité pour les 5 membres de l'équipe. Toute nouvelle page part d'ici.
Généré avec `ui-ux-pro-max` (pattern *Marketplace / Directory*, style *Soft UI Evolution*,
typo *Friendly SaaS* — Plus Jakarta Sans, choisie par l'équipe le 29/09/2026 parmi 5 propositions)
puis ajusté à la marque du cahier des charges et à l'analyse des concurrents.

---

## 1. Analyse des concurrents (septembre 2026)

| Site | Ce qu'on reprend | Ce qu'on évite / ce qu'on fait mieux |
|---|---|---|
| **Planity** (FR) | Recherche en 2 champs très visible dans le hero, ton éditorial (presse, grandes photos), sobriété noir/blanc | Aucun signal de confiance sur les salons ; pas d'IA ; pas d'affluence |
| **Fresha** | Barre de recherche 3 champs (prestation · lieu · heure), compteur live « rendez-vous pris aujourd'hui », carrousels de cartes salon (photo 4:3, note, badge « À la une ») | Fond dégradé violet un peu générique ; peu d'explication des recommandations |
| **Treatwell** | Programme de points mis en avant dès le bandeau, 3 promesses (offres, 24h/24, top-rated) | Couleurs corail criardes, bannière cookies agressive |
| **Booksy** | Rangée de catégories sous la recherche, double entrée client / professionnel | Hero photo sombre peu lisible, design daté |

**Positionnement Glowy** — la seule plateforme qui combine :
1. **Confiance** : salon vérifié (badge), avis uniquement après RDV terminé, zéro double réservation.
2. **Temps réel** : affluence et temps d'attente sur chaque carte salon, prédiction IA.
3. **IA explicable** : chaque recommandation dit « pourquoi ce salon ».
4. **Fidélité multi-salons** : points globaux + bonus « nouveau salon ».

---

## 2. Couleurs

La couleur de marque est la **prune du cahier des charges**. Thème **clair uniquement**
(le mode sombre est un anti-pattern pour la beauté, cf. ui-ux-pro-max).

| Rôle | Token Tailwind | Hex | Usage |
|---|---|---|---|
| Primaire | `bg-primary` / `plum-700` | `#6B2A5C` | CTA principaux, sélection, focus |
| Accent texte | `text-plum-600` | `#8E3B7E` | Italiques des titres, liens, eyebrows |
| Fond page | `bg-background` / `ivory` | `#FBF7F4` | Fond global (ivoire chaud, pas de blanc pur) |
| Surface | `bg-card` | `#FFFFFF` | Cartes, panneaux |
| Blush | `bg-blush` / `bg-secondary` | `#F6E9EF` | Encarts IA, chips, fonds d'icônes |
| Sable | `bg-sand` / `bg-muted` | `#F4EDE8` | Sections alternées |
| Encre | `text-ink` / `bg-ink` | `#1E1520` | Titres, section IA sombre, bouton connexion |
| Texte secondaire | `text-muted-foreground` | `#675A64` | ≥ 5,6:1 sur tous les fonds |
| Bordure | `border-border` | `#EADFDA` | Hairlines |

**États** (toujours icône + libellé, jamais la couleur seule) :
`success #17784F` (calme, confirmé) · `warning #8F5507` (modéré, en attente) · `destructive #B93A34` (forte affluence, annulé, suspect).

**Fidélité** : `bronze #9A6236` · `silver #656B79` · `gold #8C6414` (+ `gold-soft #F7EED9`) · `platinum #3F4A5C`.

**Données (palette catégorielle, ordre fixe)** — validée avec `dataviz/validate_palette.js`
(`--mode light --surface #ffffff` → ALL PASS, CVD adjacent ΔE ≥ 9,8) :

| Slot | Token | Hex | Usage |
|---|---|---|---|
| 1 | `series-1` | `#8E3B7E` | Employé 1 / série principale |
| 2 | `series-2` | `#008F82` | Employé 2 |
| 3 | `series-3` | `#B7790C` | Employé 3 |
| 4 | `series-4` | `#3569D1` | Employé 4 |
| 5 | `series-5` | `#DD5F45` | Employé 5 |

Au-delà de 5 séries : regrouper en « Autres », jamais générer une 6ᵉ teinte.
Heatmaps : rampe séquentielle prune `#FBF3F8 → #521F47` (une seule teinte).

Tous les couples texte/fond ont été mesurés ≥ 4,5:1 (WCAG AA).

---

## 3. Typographie

Une seule famille, **Plus Jakarta Sans** (variable), pour tout : site, dashboards, graphiques.

| Rôle | Police | Classe | Règles |
|---|---|---|---|
| Titres H1–H2 | Plus Jakarta Sans **700** | `.display` | Interlettrage −0,035 em, interligne 1,05 ; mot-clé mis en valeur par la **couleur prune** (`<em>` sans italique) |
| Titres de carte / H3 | Plus Jakarta Sans 600 | `font-semibold` | `tracking-tight` au-delà de 20 px |
| Interface & texte | Plus Jakarta Sans 400/500 | `font-sans` (défaut) | Corps 16 px min. mobile, interligne 1,5–1,75 |
| Arabe (RTL) | **IBM Plex Sans Arabic** | auto via `html[dir=rtl]` | CLI-06 |
| Chiffres | Plus Jakarta Sans 600 | — | `tabular-nums` seulement en colonnes (tableaux, axes, heures) |

Pas d'italique dans l'interface (la famille n'est chargée qu'en romain).

Eyebrow : `.eyebrow` (12 px, capitales, interlettrage 0,18 em, prune).

---

## 4. Formes, espacements, effets

- Rayons : boutons et champs de recherche **pilule** (`rounded-full`), cartes `rounded-2xl`/`rounded-3xl`.
- Motif signature : **l'arche** (`.arch`) — miroir de salon, logo, photo hero.
- Logo : monogramme arche + « Beauty**Hub** » en Plus Jakarta Sans 700, « Hub » en prune.
- Ombres : `shadow-soft` (repos), `shadow-lift` (survol, flottants). Pas d'ombres dures.
- Conteneur : `.container-page` (max 1280 px, gouttières 16/24/32 px).
- Sections : `py-16 lg:py-24`.
- Transitions 150–300 ms, uniquement couleur/ombre/opacity ; `prefers-reduced-motion` respecté.
- Hachures `.hatch` à 45° = créneau indisponible (canal texture, pas seulement la couleur).

---

## 5. Composants clés

| Composant | Fichier | Notes |
|---|---|---|
| Logo / monogramme | `components/brand/logo.tsx` | Arche + étincelle IA |
| Barre de recherche | `components/site/search-bar.tsx` | Variantes `hero` / `compact` |
| Carte salon | `components/salon/salon-card.tsx` | Lien étiré, favori au-dessus, « Pourquoi ce salon ? » |
| Ligne résultat + carte | `components/salon/salon-results.tsx`, `salon-map.tsx` | Survol liste ↔ pin, Leaflet/OSM |
| Badges | `components/salon/badges.tsx` | `Rating`, `VerifiedBadge`, `AffluencePill`, `PointsBadge` |
| Tunnel de réservation | `components/booking/booking-flow.tsx` | 4 étapes, verrou 10 min (RES-04), heures creuses +10 pts |
| Chatbot | `components/ai/chatbot-widget.tsx` | Réserve seulement après confirmation, repli formulaire |
| Analyse photo | `components/ai/beauty-analysis.tsx` | Consentement obligatoire, suppression, avertissement non médical |
| Fidélité | `components/loyalty/*` | `TierProgress`, `TierBadge`, `RedeemButton`, `CopyCode` |
| App shell pro | `components/app-shell/*` | Sidebar + topbar (salon & Super Admin) |
| Graphiques | `components/charts/*` | `StatTile`, `RevenueBars`, `BookingsArea`, `AffluenceHeatmap`, `BarList`, `ForecastBars` |

Composants shadcn/ui (base-ui) dans `components/ui/*` : utiliser `buttonVariants` sur un `<Link>`
pour un lien-bouton (Base UI n'a pas `asChild`).

---

## 6. Graphiques (skill dataviz)

- Une seule série → pas de légende (le titre la nomme). ≥ 2 séries → légende + libellés directs.
- Jamais de double axe. Barres ≤ 24 px, extrémités arrondies 4 px, lignes 2 px, aplat 10 %.
- Survol : réticule sur ligne/aire, info-bulle par barre/cellule ; valeur en gras, libellé en secondaire.
- Chaque graphique a une **table accessible** (`<div className="sr-only"><table>…`) —
  ne jamais mettre `sr-only` directement sur `<table>` (les tables ignorent le clip).

---

## 6 bis. Animations (GSAP 3.15 + @gsap/react)

Tout passe par `src/lib/gsap.ts` (plugins enregistrés une fois : ScrollTrigger, SplitText, useGSAP).

**Système déclaratif** — les pages serveur posent des attributs, `MotionRoot`
(`src/components/motion/motion-root.tsx`, monté par les `template.tsx` de `(site)`, `dashboard`, `admin`)
les anime et gère aussi la transition de page :

| Attribut | Effet |
|---|---|
| `data-animate="fade-up"` | monte en fondu à l'entrée dans l'écran (par lots) |
| `data-animate="stagger"` (+ `data-stagger="0.1"`) | les enfants apparaissent en cascade |
| `data-animate="split"` | titre révélé mot par mot (SplitText, lignes masquées) |
| `data-animate="count"` | nombre compté depuis 0 — **élément texte seul** (pas d'enfants) |
| `data-animate="grow-x"` / `"grow-y"` | barre qui se remplit / enfants qui montent |
| `data-animate="pop"` / `"clip"` | apparition avec rebond / image dévoilée de bas en haut |
| `data-speed="-8"` | parallaxe (yPercent parcouru pendant le scroll) |

Chorégraphies dédiées : `HeroMotion` (accueil), `AuthStage` + `AuthCard` (connexion / inscription),
`TiltCard` (carte fidélité 3D), vague de la heatmap, transitions d'étapes du tunnel de réservation.

**Règles**
- N'animer que `transform` et `opacity` (et `clip-path` pour les images) ; durées 0,4–1,2 s, `power3.out` par défaut.
- `data-animate` uniquement sur du contenu **présent au chargement** et dans une page (pas dans le header,
  le footer, un onglet ou un bloc monté plus tard) — sinon il resterait masqué.
- Dans un composant client, animer avec `useGSAP({ scope })` + `gsap.matchMedia(MOTION_OK)` ; les callbacks
  d'événements passent par `contextSafe`.
- `prefers-reduced-motion: reduce` : rien n'est masqué ni animé (CSS + `matchMedia`). `<noscript>` rend tout visible.
- Dans une timeline, un `fromTo` qui ne doit pas s'afficher au départ prend `immediateRender: false`.

---

## 7. Accessibilité & UX (non négociable)

- Cibles tactiles ≥ 44 px, focus visible (`ring-3 ring-ring/50`), `cursor-pointer` global sur les boutons.
- Icônes : **Lucide uniquement**, jamais d'emoji comme icône.
- Couleur jamais seule : statut = icône + texte ; employés = nom + couleur ; indisponible = hachures.
- Formulaires : `<label>` systématique, messages d'erreur près du champ, bouton désactivé pendant l'envoi.
- Mise en page en propriétés logiques (`ms-`, `pe-`, `start-`, `end-`) pour le RTL arabe ;
  flèches directionnelles avec `rtl:rotate-180`.
- Responsive vérifié de **320 à 1440 px**, sans défilement horizontal, en français, en anglais et en arabe (RTL) :
  coller `scripts/responsive-audit.js` dans la console du site lancé en local, puis `await __audit(['/chemin'], [320, 375, 768, 1280])` (résultat attendu : `OK`).
- **Même contenu sur téléphone et sur PC** : on adapte (réduction, retour à la ligne, défilement horizontal des rangées de puces et des tableaux), on ne masque pas.
  Seuls compactages admis : barre « Réserver » fixe, tiroir de navigation, bouton d'action en icône seule sous 420 px, prénom réduit à l'avatar sous 360 px.
- Une grille qui passe en colonnes (`lg:grid-cols-…`) commence par `grid-cols-1` : sans cela, un tableau ou un long mot élargit toute la colonne sur téléphone.
- Champs de saisie en **16 px** jusqu'à `lg` (`text-base lg:text-sm`) : iOS zoome la page au focus sous 16 px, iPad compris.
- Cibles tactiles : **44 px** (`h-11`, `min-h-11`) jusqu'à `lg` ; un lien seul sur sa ligne prend `min-h-11 inline-flex items-center`.

---

## 8. Carte des pages

| Route | Rôle | Responsable |
|---|---|---|
| `/` | Accueil (recherche, catégories, reco IA, IA, confiance, fidélité, pro) | tous |
| `/salons` | Recherche + carte | Personne 3 |
| `/salons/[slug]` | Détail salon (prestations, équipe, avis + résumé IA, affluence) | P3 · P4 · P2 |
| `/salons/[slug]/reserver` | Tunnel de réservation | Personne 3 |
| `/analyse-beaute` | Analyse photo IA | Personne 5 |
| `/pro` | Offre salons + tarifs | Personne 5 |
| `/connexion`, `/inscription` | Auth client / salon — scène sombre animée (arche, photos en boucle) | Personne 1 |
| `/compte/*` | Espace client : aperçu, RDV, fidélité, favoris | Personne 5 |
| `/dashboard`, `/dashboard/agenda`, `/dashboard/[module]` | Dashboard salon | Personne 2 |
| `/admin`, `/admin/[module]` | Super Admin | Personne 1 · P4 |

Les pages `[module]` affichent les exigences du cahier (réf., priorité, responsable)
tant que le module n'est pas construit — voir `src/lib/modules.ts`.
