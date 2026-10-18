# Glowy — Répartition du projet en 5 personnes

Chaque personne **possède** des dossiers : elle seule les modifie sans prévenir. Chacune a **1 partie classique + 1 IA**.
Les zones partagées (section 7) se modifient en petit et en prévenant l'équipe.
Explications Next.js, GSAP et lancement : [`GUIDE-EQUIPE.md`](GUIDE-EQUIPE.md).

| | Partie classique | IA |
|---|---|---|
| **P1** | Authentification + administration (Super Admin) | Recommandation de salons |
| **P2** | Dashboard du salon (gérant / employé) | Prédiction d'affluence |
| **P3** | Recherche + fiche salon + réservation | Chatbot |
| **P4** | Avis + modération | Analyse des avis |
| **P5** | Espace client + fidélité + notifications + PWA | Analyse photo (analyse beauté) |

---

## 1. Personne 1 — Auth, admin, recommandation

**Pages** : `src/app/(auth)/` (connexion, inscription), `src/app/admin/` (`page.tsx`, `[module]`, `layout.tsx`, `template.tsx`)
**API** : `src/app/api/auth/`, `src/app/api/admin/`
**Modules** : `src/modules/identity/`, `src/modules/admin/`
**Fichiers** : `src/auth.ts`, `src/auth.config.ts`, `src/proxy.ts`, `src/types/next-auth.d.ts`
**Composants** : `components/auth/`, `components/admin/`, `components/site/auth-forms.tsx`
**Tests** : à créer pour le blocage après 5 échecs, la validation des salons (un test admin existe déjà dans `tests/loyalty-reviews.test.ts`)

À faire :
- Connexion / inscription client et salon, blocage après 5 échecs, rôles, redirections.
- Admin : file de validation des salons, blocage des utilisateurs, vue globale, journal d'audit.
- **IA reco** : score de salons selon historique, favoris, catégories, lieu → nouveau `src/modules/recommendation/` + route `GET /api/me/recommendations` ; brancher le bloc « Recommandé pour vous » (`recommendedSalons` dans `modules/catalog`, aujourd'hui trié par score de démo).

## 2. Personne 2 — Dashboard salon, affluence

**Pages** : `src/app/dashboard/` (`page.tsx`, `agenda`, `[module]`, `layout.tsx`, `template.tsx`)
**API** : `src/app/api/dashboard/`
**Module** : `src/modules/dashboard/`
**Composants** : `components/dashboard/`, `components/charts/` (toutes les stats)
**Tests** : à créer (périmètre : un gérant ne voit que son salon)

À faire :
- Vue du jour, agenda semaine / jour par employé, actions rapides (en cours, terminé, absent — `setBookingStatus` du module booking).
- Gestion de l'équipe, des prestations, des horaires et congés (`createTimeOff` existe).
- Stats réelles à la place des chiffres 30 jours simulés de `lib/data.ts`.
- **IA affluence** : agrégation des réservations par jour/heure → prévision ; nouveau `src/modules/forecast/` + route `GET /api/salons/[slug]/affluence` ; brancher `affluence-heatmap.tsx` et `forecast-bars.tsx` (les champs `affluence` / `waitMinutes` des salons viennent de `lib/data.ts`).

## 3. Personne 3 — Recherche, réservation, chatbot

**Pages** : `src/app/(site)/page.tsx` (accueil), `src/app/(site)/salons/` (liste, `[slug]`, `[slug]/reserver`)
**API** : `src/app/api/salons/`, `src/app/api/bookings/`
**Modules** : `src/modules/booking/`, `src/modules/catalog/`
**Composants** : `components/booking/`, `components/salon/`, `components/site/search-bar.tsx`, `components/ai/chatbot-widget.tsx`
**Tests** : `tests/booking.test.ts` (anti double réservation : **doit rester vert**)

À faire :
- Recherche + filtres + carte Leaflet synchronisée, fiche salon, tunnel de réservation, annulation / report.
- **Chatbot** : route `POST /api/chat` (LLM + outils « chercher un salon », « lire les créneaux », données publiques uniquement), limite de débit, repli si l'API échoue ; FR / AR / EN ; brancher `chatbot-widget.tsx`.
- Accueil : P3 garde la structure, chaque personne ajoute son bloc (reco = P1, fidélité = P5…).

## 4. Personne 4 — Avis, modération, analyse des avis

**API** : `src/app/api/reviews/`
**Module** : `src/modules/reviews/`
**Composants** : section avis de `src/app/(site)/salons/[slug]/page.tsx` (bloc avis seulement), partie « avis signalés » de `components/admin/admin-queues.tsx` (avec P1)
**Tests** : à créer à côté de `tests/loyalty-reviews.test.ts` (avis impossible sans RDV terminé, réponse, signalement, modération)

À faire :
- Avis vérifiés (RDV terminé uniquement), réponse du salon, signalement, file de modération (publier / masquer), répartition des notes.
- **IA analyse des avis** : résumé, points forts / faibles, sentiment, score de toxicité pour pré-remplir la modération (décision **humaine**) → nouveau `src/modules/reviews/application/analysis.ts` (résultats déjà stockés dans `sentiment` / `suspicion` du modèle `Review`) ; badge « Résumé IA » sur la fiche salon.

## 5. Personne 5 — Espace client, fidélité, notifications, analyse photo

**Pages** : `src/app/(site)/compte/` (aperçu, `rendez-vous`, `fidelite`, `favoris`), `src/app/(site)/pro/`, `src/app/(site)/analyse-beaute/`, `src/app/offline/`, `src/app/manifest.ts`
**API** : `src/app/api/me/` (profil, favoris, fidélité, notifications)
**Modules** : `src/modules/account/`, `src/modules/loyalty/`, `src/modules/notifications/`
**Composants** : `components/account/`, `components/loyalty/`, `components/ai/beauty-analysis.tsx`, `components/pwa/`, `components/motion/tilt-card.tsx`
**Autres** : `public/sw.js`, `public/icons/`, `scripts/generate-pwa-icons.mjs`
**Tests** : `tests/loyalty-reviews.test.ts` (fidélité : **doit rester vert**)

À faire :
- Mes RDV (à venir / passés, annuler, reporter), profil, favoris.
- Fidélité : points après RDV terminé, niveaux, échange de récompenses, barème modifiable.
- Notifications dans l'application + Web Push (routes d'abonnement push à créer : `src/modules/notifications` est prêt, il manque les routes API), PWA, page `/pro`.
- **IA analyse photo** : upload sécurisé (type et taille limités) → route `POST /api/beauty-analysis` vers un modèle de vision ; consentement explicite ; mention « conseil indicatif, pas un avis médical » ; résultat stocké dans `PhotoAnalysis` ; brancher `beauty-analysis.tsx`.

---

## 6. Qui dépend de qui

```
P1 identity ──► tous (qui est connecté, quel rôle)
P3 booking  ──► P2 (agenda, statuts)  ──► P5 (points après RDV terminé)  ──► P4 (avis après RDV terminé)
P5 notifications ◄── tous (événements : réservation, avis, validation de salon)
P1 reco ◄── P3 (catalogue) + P5 (favoris)
P2 affluence ──► P3 (affichage sur la fiche et la recherche)
```

Ordre conseillé : P1 et P3 d'abord (connexion et réservation), puis P2 / P4 / P5, puis les IA.
Pour dépendre d'un autre module, **importer son `index.ts` uniquement** (ex. `@/modules/booking`), jamais ses fichiers internes.

## 7. Zones partagées (à prévenir avant de modifier)

| Zone | Règle |
|---|---|
| `src/i18n/dictionaries/{fr,en,ar}.ts` | ajouter **vos clés dans un bloc à vous** (ex. `account`, `admin`) ; toujours les 3 langues ensemble |
| `src/infrastructure/db/models.ts` | ajouter un champ ou une collection : petite PR dédiée, annoncée à l'équipe |
| `src/lib/data.ts`, `src/lib/modules.ts` | données mock : ne supprimer que ce qui est remplacé par la vraie base |
| `src/app/globals.css`, `components/ui/`, `components/motion/` (sauf `tilt-card`), `lib/gsap.ts` | design system : accord de l'équipe |
| `components/app-shell/`, `components/site/` (header, footer), `src/app/layout.tsx`, `src/app/(site)/layout.tsx` | structure commune |
| `src/modules/subscribers.ts`, `src/infrastructure/event-bus.ts`, `src/core/domain/` | ajout d'événement : petite PR dédiée |
| `package.json` | une dépendance ajoutée = prévenir |
| `src/proxy.ts` | P1 uniquement |

## 8. Travail en parallèle sans conflit

- Une branche par tâche : `p1/auth-reco`, `p2/dashboard`, `p3/chatbot`, `p4/avis-ia`, `p5/photo-ia`.
- Chacun commite dans **ses dossiers** ; un fichier d'une autre personne = lui demander ou ouvrir une petite PR séparée.
- `git pull --rebase origin main` chaque matin ; PR petites (< 400 lignes), relue par une autre personne.
- Avant la PR : `npx tsc --noEmit`, `npm run lint`, `npm test`.
- Nouvelle IA = nouveau module `src/modules/<nom>/` avec `domain/` (calcul pur testable), `application/`, `infrastructure/` ; la route API reste fine.

## 9. Planning

| Semaine | P1 | P2 | P3 | P4 | P5 |
|---|---|---|---|---|---|
| 1 | prise en main (guide, lancement, tests) + connexion / rôles | prise en main + vue du jour | prise en main + recherche / filtres | prise en main + avis vérifiés | prise en main + mes RDV |
| 2 | admin : validation, utilisateurs | agenda + statuts | fiche salon + tunnel | réponse + signalement | fidélité : niveaux, échange |
| 3 | audit + tests | équipe, services, horaires | annulation / report + tests | modération + tests | notifications + push |
| 4 | **IA reco** | **IA affluence** | **IA chatbot** | **IA analyse avis** | **IA analyse photo** |
| 5 | animations GSAP + responsive 375 / 768 / 1024 / 1280 + accessibilité | idem | idem | idem | idem |
| 6 | intégration, `npm run build`, bugs, démo | | | | |
