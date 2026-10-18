# Glowy — Répartition du travail en 5 personnes

Source : *Cahier des charges Glowy v1.0 (28 septembre 2026)*, sections 3, 4 et 8.
Chaque personne a **1 tâche classique + 1 IA**. Priorités du cahier : **I** = Indispensable (nécessaire à la démo), **Imp** = Important (version finale), **B** = Bonus.
État : ✅ fait · 🟡 partiel (existe mais incomplet) · ⬜ à faire. *État estimé d'après le code au 18 octobre 2026.*

Explications Next.js, GSAP, lancement : [`GUIDE-EQUIPE.md`](GUIDE-EQUIPE.md).

| | Tâche classique | IA |
|---|---|---|
| **P1** | Authentification, rôles et Super Admin (§3.1, §3.6) | Recommandation de salons (§4.3) |
| **P2** | Dashboard salon (§3.4) | Prédiction d'affluence (§4.5) |
| **P3** | Recherche et réservation (§3.2) | Chatbot de réservation (§4.2) |
| **P4** | Avis, modération et support (§3.5) | Analyse des avis (§4.4) |
| **P5** | Espace client, paiement, abonnements et fidélité (§3.3, §3.7, ADM-05) | Analyse beauté par photo (§4.1) |

---

## P1 — Authentification, rôles, Super Admin + IA recommandation

**Dossiers possédés** : `src/modules/identity/`, `src/modules/admin/`, `src/app/(auth)/`, `src/app/admin/`, `src/app/api/auth/`, `src/app/api/admin/`, `src/auth.ts`, `src/auth.config.ts`, `src/proxy.ts`, `components/auth/`, `components/admin/` (hors file de modération = P4), `components/site/auth-forms.tsx`.

| Réf. | Exigence | Prio | État |
|---|---|---|---|
| AUTH-01 | Inscription client | I | ✅ |
| AUTH-02 | Inscription salon + justificatif, en attente de validation | I | ✅ |
| AUTH-03 | Connexion / déconnexion sécurisées, session | I | ✅ |
| AUTH-04 | 4 rôles, contrôle d'accès sur chaque page et API | I | ✅ |
| AUTH-05 | Réinitialisation du mot de passe par e-mail | Imp | ⬜ |
| AUTH-06 | Vérification de l'adresse e-mail | Imp | ⬜ |
| AUTH-07 | Création de comptes employés par le gérant | Imp | ⬜ (page à construire avec P2 : `dashboard/equipe`) |
| AUTH-08 | Connexion avec Google | B | ⬜ |
| ADM-01 | Vue globale : salons, clients, réservations, revenus, graphiques | I | 🟡 (chiffres réels ; courbes de croissance simulées) |
| ADM-02 | Validation / refus des nouveaux salons | I | ✅ |
| ADM-03 | Suspension / réactivation, voir le dashboard d'un salon | I | 🟡 (API faite, écran `admin/salons` à construire) |
| ADM-04 | Utilisateurs : liste, blocage, réinitialisation | I | 🟡 (API de blocage faite, écran `admin/utilisateurs` à construire) |
| ADM-06 | Catalogue global : catégories, villes, langues | Imp | ⬜ |
| ADM-07 | Journal d'audit | Imp | 🟡 (écrit en base et affiché dans la vue globale, page dédiée à faire) |
| ADM-08 | Rapports par ville / service / salon + export | Imp | ⬜ |
| ADM-09 | Réglage du barème de fidélité, campagnes « double points » | Imp | 🟡 (collection `PointRule` prête, interface à construire — le moteur est à P5) |
| ADM-10 | Annonces et notifications à tous | B | ⬜ |

**IA — Recommandation de salons (§4.3)** ⬜ simulée (score de démo dans `lib/data.ts`)
Entrée : historique, favoris, préférences, position, notes des salons, résultat de l'analyse photo. Sortie : liste classée avec score et explication « pourquoi ce salon ». Technologie : filtrage par similarité + score pondéré (distance, note, services, préférences).
Critères : recommandations différentes selon le profil ; bonus pour un salon nouveau (lien avec la fidélité) ; nouveau client sans historique → salons les plus populaires à proximité ; message de secours si indisponible.
Création : `src/modules/recommendation/` (domaine pur testable) + `GET /api/me/recommendations`, branché sur `recommendedSalons` (`modules/catalog`).

**Fournit** : l'authentification et les rôles **dès le début** (déjà faits) ; l'interface de réglage du barème. **Dépend de** : salons (P2), historique (P3), notes (P4), analyse photo (P5) → données du seed au départ.

**Modèles à ajouter** (si besoin) : `Role`/`Session` sont gérés par Auth.js ; `VerificationBadge` (AVI-03, aujourd'hui le champ `verified` du salon).

---

## P2 — Dashboard salon + IA prédiction d'affluence

**Dossiers possédés** : `src/modules/dashboard/`, `src/app/dashboard/`, `src/app/api/dashboard/`, `components/dashboard/`, `components/charts/`.

| Réf. | Exigence | Prio | État |
|---|---|---|---|
| SAL-01 | Vue d'ensemble : RDV du jour, CA, taux de remplissage | I | ✅ |
| SAL-02 | Profil du salon : description, adresse, photos, portfolio avant/après | I | ⬜ (`dashboard/parametres`) |
| SAL-03 | Services : prix, durées, catégories, forfaits | I | ⬜ (`dashboard/services`) |
| SAL-04 | Agenda jour / semaine / mois, couleurs par employé, blocage de créneaux | I | 🟡 (vue jour faite ; semaine, mois et blocage via `createTimeOff` à brancher) |
| SAL-05 | Employés : comptes, horaires, congés | I | ⬜ (`dashboard/equipe`) |
| SAL-06 | Statistiques : CA, services populaires, heures de pointe, annulations, absences | I | ⬜ (chiffres 30 jours simulés) |
| SAL-07 | Paramètres : horaires d'ouverture, politique d'annulation, acompte | Imp | ⬜ |
| SAL-08 | Mini-CRM : fiche client, historique, notes, clients inactifs | Imp | ⬜ (`dashboard/clients`) |
| SAL-09 | Caisse et factures PDF | Imp | ⬜ |
| SAL-10 | Promotions, codes promo, offres de dernière minute | Imp | ⬜ |
| SAL-11 | Export des rapports PDF / Excel | Imp | ⬜ |
| SAL-12 | Stocks avec alerte de stock bas | B | ⬜ |
| SAL-13 | Commissions des employés | B | ⬜ |
| SAL-14 | Plusieurs succursales | B | ⬜ |

**IA — Prédiction d'affluence (§4.5)** ⬜ simulée (`affluence` / `waitMinutes` dans `lib/data.ts`)
Entrée : historique des réservations (données simulées au départ). Sortie : prévision par jour et par heure, conseils de planning (nombre d'employés), heures creuses pour les promotions et les points bonus. Technologie : régression / séries temporelles, service Python **ou** calcul dans Next.js.
Critères : erreur de prévision mesurée sur des données de test ; affichage dans le dashboard ; **heures creuses transmises au moteur de fidélité (P5)**.
Création : `src/modules/forecast/` + `GET /api/salons/[slug]/affluence`, branché sur `affluence-heatmap.tsx` et `forecast-bars.tsx`.

**Fournit** : services, horaires et employés à P3 ; heures creuses à P5. **Dépend de** : authentification (P1), réservations (P3).

**Modèles à ajouter** : `Package` (forfaits), `Promotion`, `StockItem`, `ClientNote`, `Invoice`.

---

## P3 — Recherche et réservation + IA chatbot

**Dossiers possédés** : `src/modules/booking/`, `src/modules/catalog/`, `src/app/(site)/salons/`, `src/app/(site)/page.tsx` (accueil, chaque personne y ajoute son bloc), `src/app/api/salons/`, `src/app/api/bookings/`, `components/booking/`, `components/salon/`, `components/site/search-bar.tsx`, `components/ai/chatbot-widget.tsx`.
**Tests à garder verts** : `tests/booking.test.ts`.

| Réf. | Exigence | Prio | État |
|---|---|---|---|
| RES-01 | Recherche par ville, service, note et prix | I | ✅ |
| RES-02 | Page détail : services, prix, horaires, photos, avis | I | ✅ |
| RES-03 | Réservation : service, employé, créneau | I | ✅ |
| RES-04 | Verrou anti-conflit (aucun créneau réservé deux fois) | I | ✅ (test automatisé) |
| RES-05 | Confirmation, annulation, report selon la politique du salon | I | ✅ |
| RES-06 | Carte des salons (OpenStreetMap) | Imp | ✅ |
| RES-07 | Rappels par e-mail et SMS avant le RDV | Imp | 🟡 (confirmation simulée à la réservation ; rappels planifiés à faire) |
| RES-08 | File d'attente virtuelle et affluence en temps réel | Imp | ⬜ (modèle `WaitingQueue` absent) |
| RES-09 | Liste d'attente pour un créneau complet | B | ⬜ |

**IA — Chatbot de réservation (§4.2)** ⬜ composant d'interface simulé
Entrée : message libre (« je veux une coupe pour un mariage samedi »). Sortie : salons et créneaux **réellement disponibles**. Technologie : modèle de langage avec appel des API de recherche et de réservation.
Critères : comprend service, date et heure ; propose **au moins 3 créneaux réels** ; **ne réserve qu'après confirmation explicite** ; fonctionne en français et en arabe ; repli vers le formulaire si le service IA est indisponible.
Création : `POST /api/chat` (limite de débit, données publiques uniquement), branché sur `chatbot-widget.tsx`.

**Fournit** : l'événement `booking.completed` à P4 et P5 ; l'historique de réservations à P1 et P2. **Dépend de** : services et horaires (P2), authentification (P1).

**Modèles à ajouter** : `WaitingQueue`, `Slot` (si créneaux explicites).

---

## P4 — Avis, modération, support + IA analyse des avis

**Dossiers possédés** : `src/modules/reviews/`, `src/app/api/reviews/`, `dashboard/avis`, `admin/moderation`, la file de modération de `components/admin/admin-queues.tsx` (avec P1), le bloc avis de la fiche salon.
**Tests** : à créer (le test fidélité/avis existe dans `tests/loyalty-reviews.test.ts`).

| Réf. | Exigence | Prio | État |
|---|---|---|---|
| AVI-01 | Avis seulement après un RDV terminé (avis vérifié) | I | ✅ |
| AVI-02 | Note 1 à 5, commentaire, photo optionnelle | I | ✅ (envoi de photo à brancher côté interface) |
| AVI-03 | Badge « Salon vérifié » après validation du Super Admin | I | ✅ (validation faite par P1) |
| AVI-04 | Réponse du salon à un avis | Imp | 🟡 (API faite, écran `dashboard/avis` à construire) |
| AVI-05 | Signalement d'un avis par le salon ou un utilisateur | Imp | 🟡 (API faite, bouton à brancher) |
| AVI-06 | Espace de modération : avis et signalements | Imp | 🟡 (file affichée dans la vue admin, page `admin/moderation` à construire) |
| AVI-07 | Tickets de support clients et salons | B | ⬜ (modèle `SupportTicket` absent) |

**IA — Analyse des avis (§4.4)** ⬜ simulée (`sentiment` et `suspicion` stockés dans `Review`)
Entrée : textes des avis d'un salon. Sortie : sentiment (positif, neutre, négatif), résumé des points forts et faibles, **score de suspicion par avis**. Technologie : modèle de langage **ou** modèle de sentiment pré-entraîné + règles (textes copiés, comptes récents).
Critères : résumé affiché sur la page du salon ; avis suspects envoyés à la modération ; **décision finale toujours humaine**.
Création : `src/modules/reviews/application/analysis.ts` + résumé mis en cache, relancé à chaque nouvel avis.

**Fournit** : l'événement `review.published` à P5 ; les notes des salons à P1 et P3. **Dépend de** : réservations terminées (P3), authentification (P1).

**Modèles à ajouter** : `SupportTicket`.

---

## P5 — Espace client, paiement, abonnements, fidélité + IA analyse photo

**Dossiers possédés** : `src/modules/account/`, `src/modules/loyalty/`, `src/modules/notifications/`, `src/modules/subscription/`, `src/app/(site)/compte/`, `src/app/(site)/pro/`, `src/app/(site)/analyse-beaute/`, `src/app/api/me/`, `components/account/`, `components/loyalty/`, `components/ai/beauty-analysis.tsx`, `components/pwa/`, `src/i18n/`, `public/sw.js`, `src/app/manifest.ts`, `admin/abonnements`, `dashboard/abonnement`.
**Tests à garder verts** : `tests/loyalty-reviews.test.ts`, `tests/subscription.test.ts`.

| Réf. | Exigence | Prio | État |
|---|---|---|---|
| CLI-01 | Profil client modifiable | I | 🟡 (API `PATCH /api/me`, formulaire à vérifier) |
| CLI-02 | Historique des rendez-vous | I | ✅ |
| CLI-03 | Favoris (salons et professionnels) | Imp | 🟡 (salons faits, professionnels à faire) |
| CLI-04 | « Refaire le même rendez-vous » | Imp | 🟡 (liste affichée sur l'aperçu, réservation en un clic à brancher) |
| CLI-05 | Acompte et paiement en ligne (mode test) | Imp | 🟡 (paiement test enregistré, interface de paiement à finir) |
| CLI-06 | Interface FR / AR (RTL) / EN | Imp | ✅ |
| CLI-07 | Notifications dans l'application | Imp | 🟡 (API faite, cloche d'interface et abonnement push à brancher) |
| ADM-05 | Plans Gratuit / Pro / Premium et commissions | Imp | 🟡 (paiement du plan déclaré par le gérant et accepté ou refusé par le Super Admin, plan actif 30 jours : fait, module `src/modules/subscription` ; commissions sur réservations payées en ligne, expiration automatique et page `/pro` à faire) |
| FID-01 | Points Glowy globaux : solde et historique | I | ✅ |
| FID-02 | Gain de points selon le barème, bonus « nouveau salon », paliers | I | ✅ |
| FID-03 | Niveaux Bronze / Argent / Or / Platine, barre de progression | Imp | ✅ |
| FID-04 | Catalogue de récompenses et échange | Imp | ✅ |
| FID-05 | Parrainage avec code personnel | Imp | 🟡 (code + points faits, saisie du code à l'inscription à vérifier) |
| FID-06 | Points et récompenses propres à chaque salon (créés par le gérant) | Imp | ⬜ (écran côté `dashboard/promotions`, avec P2) |
| FID-07 | Anti-fraude et expiration à 12 mois | Imp | 🟡 (plafonds faits, expiration à planifier + prévenir avant) |
| FID-08 | Badges (Explorateur, Fidèle, Critique utile, Ambassadeur, Ponctuel) | B | 🟡 (calculés, `Badge`/`UserBadge` non stockés) |

**IA — Analyse beauté par photo (§4.1)** ⬜ simulée (`beauty-analysis.tsx`)
Entrée : photo de cheveux ou de visage, **avec consentement**. Sortie : état général, problèmes détectés, conseils, services recommandés (JSON structuré). Technologie : modèle de langage avec vision (API), prompt structuré.
Critères : réponse en **moins de 15 secondes** ; message « conseil indicatif, pas un diagnostic médical » ; **suppression de la photo possible à tout moment** ; résultat enregistré dans l'historique (`PhotoAnalysis`) ; +10 points une fois par mois.
Création : `POST /api/beauty-analysis` (type et taille limités).

**Fournit** : le moteur de points et de récompenses ; l'historique des analyses à P1. **Dépend de** : authentification (P1), réservations (P3), événements de P3 et P4, heures creuses de P2.

**Modèles à ajouter** : `Plan`, `Subscription`, `Referral`, `Tier`, `Badge`, `UserBadge`, `Invoice` (avec P2).

---

## Règles communes

**Livrables de chaque tâche** (§8) : schéma de base et données de test, API, interface, tests, documentation (fonctionnement, limites, exemples).
**Règle de dépendance** (§8) : P1 livre l'authentification de base dès le début ; les autres avancent avec le jeu de données de test (`npm run db:seed`) et branchent les vrais modules ensuite. Les modules communiquent **par événements** (`booking.completed`, `review.published`…) : on ajoute un abonné dans `src/modules/subscribers.ts` sans modifier le module émetteur.
**Chaque IA** est une **API indépendante** avec un **message de secours** si le service est indisponible.

**Organisation de l'équipe** (§13) :
- Branche `main` protégée, **une branche par fonctionnalité** (`feature/nom`), fusion par **pull request relue par un autre membre**.
- Messages de commit courts : `feat(booking): ajout du verrou de créneau`.
- Suivi : tableau **GitHub Projects** (À faire, En cours, En revue, Terminé), une carte par exigence du cahier.
- Réunions : point de 15 minutes **2 fois par semaine**, revue d'avancement en fin de semaine.
- Qualité : lint et tests à chaque pull request (**GitHub Actions**, à mettre en place).
- Toute décision sur la base de données ou les API est **notée dans la documentation**.

**Zones partagées** (prévenir l'équipe avant de modifier) :

| Zone | Règle |
|---|---|
| `src/i18n/dictionaries/{fr,en,ar}.ts` | ajouter vos clés dans un bloc à vous ; toujours les 3 langues ensemble (le propriétaire du dossier `i18n` est P5) |
| `src/infrastructure/db/models.ts` | ajouter un modèle : petite PR dédiée, annoncée |
| `src/lib/data.ts`, `src/lib/modules.ts` | données mock : ne supprimer que ce qui est remplacé par la vraie base |
| `globals.css`, `components/ui/`, `components/motion/`, `lib/gsap.ts` | design system : accord de l'équipe |
| `components/app-shell/`, `components/site/` (header, footer), layouts racines | structure commune |
| `src/modules/subscribers.ts`, `src/infrastructure/event-bus.ts`, `src/core/domain/` | ajout d'événement : petite PR dédiée |
| `package.json` | une dépendance ajoutée = prévenir |

## Écarts entre le cahier et le code à décider ensemble

| Cahier | Code actuel | Décision à noter |
|---|---|---|
| PostgreSQL + Prisma (§6, §10) | **MongoDB + Mongoose**, migration faite le 18 octobre | confirmer, puis mettre à jour le cahier ; la protection contre les injections passe par Zod + Mongoose, pas « requêtes paramétrées Prisma » |
| Tests : Jest + Playwright (§6) | `node:test` + `tsx` (14 tests) | garder `node:test` ou migrer ; Playwright pour les parcours complets à ajouter |
| CI GitHub Actions (§13) | absente | à créer (lint, `tsc`, `npm test`) — proposition : P1 |
| Images : Cloudinary ou S3 (§6) | URLs d'images externes uniquement | choisir un stockage avant l'envoi de photos (P2 portfolio, P4 avis, P5 analyse) |
| Déploiement : Vercel + base hébergée (§6, §12) | non fait | MongoDB Atlas + Vercel ; à faire avant la démo |
| Livrables : UML, schéma de base, slides (§12) | non fait | chaque personne dessine les diagrammes de son module (cas d'utilisation, classes, séquences) |

## Critères d'acceptation et démonstration (§12)

Minimum : un client s'inscrit, se connecte, cherche et réserve sans conflit (P1, P3) · un gérant valide et suit ses RDV (P2) · le Super Admin valide, suspend, voit la vue globale (P1) · avis uniquement après un RDV terminé (P4) · points après un RDV terminé avec bonus « nouveau salon » et niveau (P5) · **les 5 IA répondent avec un message de secours en cas de panne**.

Scénario de 5 minutes : photo → conseils (P5) · recommandation d'un salon avec bonus nouveau salon (P1) · réservation par formulaire ou chatbot (P3) · le gérant voit le RDV et la prévision d'affluence (P2) · avis vérifié résumé par l'IA et points gagnés (P4, P5) · le Super Admin suit l'activité et modère un avis suspect (P1, P4).

## Planning (6 semaines)

| Semaine | Objectif |
|---|---|
| 1 | prise en main (guide, lancement, tests) ; figer les écarts ci-dessus ; GitHub Projects + CI |
| 2–3 | les exigences **Indispensable** de chaque personne (colonnes « I » ⬜ et 🟡) |
| 4 | les **Important**, puis les 5 **IA** (version simple avec repli, puis améliorée) |
| 5 | responsive 375 / 768 / 1024 / 1280, accessibilité, animations, tests |
| 6 | intégration, déploiement, UML et documentation, slides, répétition de la démo ; les **Bonus** seulement s'il reste du temps |
