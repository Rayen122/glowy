# Glowy — Les 5 gestions de la plateforme

Glowy est une plateforme de réservation de salons de beauté vérifiés en Tunisie (prix en dinars, interface en français, arabe et anglais).
Le projet est découpé en **5 gestions**, une par membre de l'équipe. Chaque gestion comprend une partie classique et une **intelligence artificielle**.

*État décrit d'après le code au 23 octobre 2026.* Détail des exigences : [`REPARTITION.md`](REPARTITION.md) · routes API : [`API.md`](API.md) · lancement et conventions : [`GUIDE-EQUIPE.md`](GUIDE-EQUIPE.md).

| # | Gestion | Responsable | IA associée |
|---|---|---|---|
| 1 | Comptes, sécurité et Super Admin | P1 | Recommandation de salons |
| 2 | Salon (dashboard du gérant) | P2 | Prédiction d'affluence |
| 3 | Recherche et réservation | P3 | Assistante de réservation |
| 4 | Avis, modération et support | P4 | Analyse des avis |
| 5 | Espace client, fidélité et abonnements | P5 | Analyse beauté par photo, essai virtuel de couleur |

---

## Socle commun

- **Langage** : TypeScript, pour le site comme pour le serveur.
- **Framework** : Next.js 16 (App Router), React 19, Tailwind CSS 4, animations GSAP.
- **Base de données** : MongoDB, avec Mongoose. Les modèles sont dans `src/infrastructure/db/models.ts`.
- **Authentification** : Auth.js v5 (session JWT). Il y a 4 rôles : **cliente**, **employé**, **gérant**, **Super Admin**.
- **Architecture** : un module par domaine dans `src/modules/<module>/`, découpé en 3 couches :
  - `domain` : règles pures, testées sans base ;
  - `application` : cas d'usage et validation Zod ;
  - `infrastructure` : accès à MongoDB.
- **Communication entre gestions** : par **événements** (`booking.completed`, `review.published`…), branchés dans `src/modules/subscribers.ts`. Une gestion réagit au travail d'une autre sans modifier son code.
- **Les 6 IA utilisent de vrais modèles d'IA par API**, gratuits : **Groq GPT-OSS 120B** pour l'assistante, **Google Gemini Flash-Lite** pour la recommandation, les conseils d'affluence, l'analyse des avis, l'analyse photo (vision) et la modération. Clés `GROQ_API_KEY` et `GEMINI_API_KEY` dans `.env`.
- Chaque IA garde un **algorithme local explicable et testé en secours** : sans clé, quota dépassé ou panne, le site fonctionne toujours (et les tests automatiques tournent sans clé). Les réponses des modèles sont **contrôlées** avant usage (valeurs connues, bornes, dates vérifiées).
- **Tâches planifiées** (`src/modules/scheduler.ts`, toutes les 10 minutes) : rappels de rendez-vous, expiration des points, analyse des avis en attente.
- **Tests** : `npm test`, soit 73 tests sur une base MongoDB dédiée.

---

## 1. Gestion des comptes, de la sécurité et du Super Admin (P1)

**But :** permettre à chacun de créer un compte et de se connecter en sécurité, et donner au Super Admin le contrôle de toute la plateforme.

### Fonctionnalités

**Comptes**
- Inscription d'une cliente (compte actif tout de suite), avec code de parrainage facultatif.
- Inscription d'un salon avec justificatif. Le salon reste **en attente** jusqu'à sa validation par le Super Admin et n'apparaît pas dans la recherche avant.
- Connexion par e-mail et mot de passe, ou **avec Google**. Une connexion démo par rôle est disponible si `DEMO_LOGIN=true`.
- Mot de passe oublié : un lien valable **1 heure**, à usage unique.
- Vérification de l'adresse e-mail : un lien valable **48 heures**.
- Changement du mot de passe depuis son compte.
- Comptes des employés créés par le gérant, avec un mot de passe temporaire.

**Sécurité**
- Mots de passe hachés avec bcrypt.
- **Blocage 15 minutes après 5 échecs** de connexion.
- Contrôle du rôle sur chaque page (`src/proxy.ts`) **et** sur chaque API.
- Protection CSRF : une écriture venant d'un autre site est refusée.
- Les liens envoyés par e-mail utilisent `APP_URL`, pour ne pas être piégés par l'en-tête `Host`.
- Au plus un e-mail de lien par minute et par compte.

**Super Admin** (`/admin`)
- **Vue globale** : salons, clientes, réservations, revenus, courbes sur 12 mois.
- **Salons** : validation ou refus, suspension et réactivation, consultation du dashboard d'un salon.
- **Utilisateurs** : liste, blocage et déblocage, envoi d'un lien de réinitialisation.
- **Journal d'audit** de toutes les actions sensibles.
- **Rapports** par ville, prestation et salon, avec export.
- **Catalogue global** : villes, catégories, langues ; taux de commission ; **annonces** envoyées à tous.
- **Barème de fidélité** et campagnes « double points » (le moteur de points relève de la gestion 5).
- **Boîte d'envoi** : e-mails et SMS envoyés ou simulés.

### IA — Recommandation de salons

- **Entrées** : rendez-vous terminés (catégories, prestations, ville, budget), salons favoris, note des salons, disponibilités du jour.
- **Méthode** :
  - un profil de goûts est construit à partir de l'historique, et un **score local** présélectionne les 8 meilleurs salons (ressemblance avec le profil, **note bayésienne**, créneaux libres du jour) ;
  - le **modèle Gemini** reçoit ce profil et ces candidats, choisit et **classe les 6 salons** qui conviennent le mieux à la cliente et **écrit la raison** « Pourquoi ce salon ? » dans la langue de la page. Le résultat est gardé 30 minutes par cliente.
- **Sortie** : une liste classée, avec la raison écrite par l'IA (« Retrouvez votre coiffeur favori à La Marsa pour votre coupe et brushing habituels »).
- **Repli** : sans historique (visiteur ou nouveau compte), les salons les plus populaires ; si le modèle ne répond pas en 6 secondes, l'ordre du score local.
- **Code** : `src/modules/catalog/infrastructure/ai-recommend.ts` (modèle) · `src/modules/catalog/domain/recommend.ts` (score et contrôle) · `GET /api/ai/recommendations`.

### Repères techniques

| | |
|---|---|
| Modules | `identity`, `admin`, `platform` |
| Pages | `/connexion`, `/inscription`, `/mot-de-passe-oublie`, `/reinitialiser`, `/verifier-email`, `/admin/*` |
| API | `/api/auth/*`, `/api/me/password`, `/api/me/verify-email`, `/api/admin/*`, `/api/ai/recommendations` |
| Collections | `User`, `AccountToken`, `AuditLog`, `PlatformSetting`, `Announcement` |
| Événements émis | `user.registered`, `salon.registered`, `salon.statusChanged` |
| Tests | `oauth`, `password-reset`, `platform`, `recommend`, `loyalty-admin` |

---

## 2. Gestion du salon — dashboard du gérant (P2)

**But :** donner au gérant et à son équipe un vrai outil de travail au quotidien : agenda, équipe, caisse, clientes et statistiques.

### Fonctionnalités

- **Mise en route** du salon après validation : horaires, première prestation, premier employé.
- **Vue d'ensemble** : rendez-vous du jour, chiffre d'affaires, taux de remplissage.
- **Agenda** jour, semaine et mois. Chaque employé a sa couleur, et les créneaux peuvent être bloqués ou débloqués.
- **Prestations** : prix, durées, catégories, ancien prix (promo), prestations populaires.
- **Profil du salon** : description, adresse, photos et portfolio envoyés depuis le dashboard.
- **Équipe** : employés, horaires de travail, congés, comptes de connexion, **commissions** par professionnel.
- **Paramètres** : horaires d'ouverture, délai d'annulation, pourcentage d'acompte.
- **Mini-CRM** : fiche de chaque cliente, historique, notes privées, clientes inactives.
- **Caisse** : encaissement et **factures imprimables** numérotées.
- **Promotions** :
  - codes promo et offres de dernière minute ;
  - récompenses propres au salon, payées en **points salon** distincts des points Glowy.
- **Statistiques réelles** : chiffre d'affaires, prestations populaires, heures de pointe, annulations, absences. Export Excel et PDF.
- **Stocks** avec alerte de stock bas ; **plusieurs succursales** (bonus).
- **File d'attente** : l'équipe appelle, sert ou retire les clientes arrivées sans rendez-vous.

### IA — Prédiction d'affluence

- **Entrées** : les rendez-vous des **8 dernières semaines**, pour le même jour de la semaine, et le nombre de professionnels actifs.
- **Méthode** :
  - taux d'occupation de l'équipe heure par heure ;
  - moyenne **pondérée**, où les semaines récentes comptent plus ;
  - classement de chaque heure en *calme* (moins de 35 %), *modérée* ou *forte* (70 % et plus).
- **Sorties** :
  - la courbe du jour ;
  - le meilleur créneau de 2 heures ;
  - l'**affluence en direct** et l'attente estimée dans la file ;
  - les **heures creuses**, transmises à la réservation (gestion 3) pour accorder **+10 points** aux clientes qui y réservent.
- **Conseils de l'IA** (dashboard du gérant) : le **modèle Gemini** analyse le tableau de la semaine et les prestations du salon et rédige **3 conseils chiffrés** : où renforcer l'équipe, quelle offre lancer (prestation, jour, heure) pour remplir un creux, comment s'organiser. Les chiffres viennent du tableau (vérifié). Gardés 6 heures.
- **Repli** : sans historique suffisant (nouveau salon), une courbe type d'un salon de quartier est utilisée, sans conseils de l'IA. La source est affichée honnêtement.
- **Code** : `src/modules/affluence/domain/forecast.ts` (prévision) · `src/modules/affluence/infrastructure/ai-advice.ts` (conseils) · `/api/salons/[slug]/live`, `/api/salons/[slug]/queue`.

### Repères techniques

| | |
|---|---|
| Modules | `dashboard`, `promotions`, `affluence` |
| Pages | `/dashboard`, `/dashboard/{agenda, services, equipe, parametres, clients, caisse, promotions, statistiques, stocks, succursales, file-attente}` |
| API | `/api/dashboard/*` |
| Collections | `Salon` (horaires, photos et prestations imbriqués), `Employee`, `TimeOff`, `ClientNote`, `Invoice`, `Promotion`, `SalonWallet`, `SalonPointEntry`, `Product`, `StockMovement`, `QueueEntry` |
| Tests | `dashboard`, `cashier`, `promotions`, `stocks`, `branches`, `commissions`, `affluence` |

---

## 3. Gestion de la recherche et des réservations (P3)

**But :** permettre à une cliente de trouver un salon et de réserver un créneau **sans jamais de double réservation**.

### Fonctionnalités

- **Recherche** par ville, prestation, note, prix et disponibilité du jour, avec une **carte** OpenStreetMap.
- **Fiche salon** : prestations et prix, équipe, horaires, photos, avis, affluence en direct.
- **Tunnel de réservation** : prestations, puis professionnel (ou « peu importe »), puis créneau, puis paiement. Le paiement se fait sur place, ou par acompte en ligne en mode test.
- **Devis** avant confirmation : total, acompte, code promo, offre de dernière minute.
- **Annulation et report** selon la politique du salon. Au-delà du délai fixé par le salon, l'annulation compte comme tardive.
- **Suivi par le salon** : en cours, terminé, absence.
- **Rappels** par e-mail, SMS et notification la veille puis 2 heures avant.
- **Liste d'attente** d'un jour complet : la cliente est prévenue si une annulation libère un créneau qui lui convient.
- **File d'attente virtuelle** : la cliente prend sa place depuis la fiche du salon et suit sa position.

### Règles clés

- **Anti double réservation** : chaque réservation verrouille ses tranches de 5 minutes dans la collection `SlotLock`, protégée par un index **unique** (employé + tranche). Si deux réservations arrivent en même temps, une seule passe. Un test le vérifie : 10 réservations simultanées du même créneau, une seule acceptée.
- **Créneaux et délais** :
  - créneaux proposés toutes les 30 minutes ;
  - impossible de réserver moins de 15 minutes à l'avance.
- **Acompte en ligne** :
  - 20 % du total par défaut, réglable par le salon ;
  - borné entre 10 et 30 DT, et jamais plus que le total.

### IA — Assistante de réservation

- **Entrée** : une phrase libre en français, en arabe, en derja tunisienne (lettres arabes ou arabizi) ou en anglais. Par exemple : « nheb n9os cha3ri nhar el thlath sbe7 ».
- **Méthode** :
  - le **modèle Groq GPT-OSS 120B** comprend la demande (prestation, date, moment, heure, ville, salon) avec les données du site, et répond aux questions (prix, horaires, règles) dans la langue et l'écriture du client ;
  - le site cherche de **vrais créneaux libres** dans les salons les mieux adaptés (ordre de la recommandation de la gestion 1), puis le modèle rédige la réponse ;
  - un jour nommé (« jeudi », « ghodwa ») est recalculé par les règles ; les gros mots sont masqués avant tout envoi au modèle.
- **Sortie** : des créneaux réels proposés. La réservation n'est faite **qu'après confirmation explicite**, par l'API de réservation habituelle.
- **Repli** : Gemini si Groq ne répond pas, puis l'assistante à règles (`nlu.ts`), puis le formulaire de réservation.
- **Code** : `src/modules/assistant/infrastructure/ai-chat.ts` (modèles) · `src/modules/assistant/domain/nlu.ts` (règles) · `POST /api/ai/chat`.

### Repères techniques

| | |
|---|---|
| Modules | `booking`, `catalog`, `assistant` |
| Pages | `/` (accueil), `/salons`, `/salons/[slug]`, `/salons/[slug]/reserver`, fenêtre de l'assistante |
| API | `/api/salons/*` (recherche, fiche, disponibilités, devis, liste d'attente), `/api/bookings/*`, `/api/ai/chat` |
| Collections | `Booking` (prestations et paiement imbriqués), `SlotLock`, `WaitlistEntry` |
| Événements émis | `booking.created`, `booking.cancelled`, `booking.completed`, `booking.noShow` |
| Tests | `booking`, `waitlist`, `assistant`, `scheduler` |

---

## 4. Gestion des avis, de la modération et du support (P4)

**But :** des avis **vérifiés et fiables**, et un moyen pour clientes et salons de signaler un problème.

### Fonctionnalités

- **Avis vérifié** : possible dès que **l'heure du rendez-vous est passée** (sans attendre que le salon le marque « terminé »), par la cliente concernée, une seule fois ; jamais sur un rendez-vous annulé ou une absence.
- Note de 1 à 5, commentaire et photo facultative.
- **Réponse du salon** à un avis, depuis `/dashboard/avis`.
- **Signalement** d'un avis par le salon ou par un utilisateur.
- **Modération** par le Super Admin (`/admin/moderation`) : il garde ou masque l'avis. La **décision finale est toujours humaine**.
- **Badge « Salon vérifié »** après validation du justificatif (gestion 1).
- **Support** : tickets ouverts par les clientes (`/compte/support`) et les salons (`/dashboard/support`), traités par le Super Admin (`/admin/support`).

### IA — Analyse des avis

- **Entrée** : le texte et la note de chaque avis.
- **Méthode** :
  - le **modèle Gemini** lit chaque avis à sa publication : **sentiment** (il comprend l'ironie, les avis mitigés, la derja), **aspects** (accueil, résultat, attente, prix, propreté, conseil, ponctualité, chacun positif ou négatif) et **score de suspicion** de 0 à 100 avec sa raison ;
  - les règles locales ajoutent les indices objectifs de faux avis (lien, mots répétés, majuscules, note contredite) : la suspicion retenue est la plus haute des deux ; à partir de 50, l'avis part en modération ;
  - Gemini rédige aussi le **résumé des avis** du salon en français, arabe et anglais, recalculé quand de nouveaux avis arrivent.
- **Sorties** :
  - sur la fiche du salon et le dashboard : le résumé écrit par l'IA, la répartition des sentiments, les points forts et à améliorer ;
  - pour la modération : les avis suspects envoyés en file, avec la raison donnée par l'IA.
- **Repli** : lexique français, anglais, arabe et derja (négations, emojis) croisé avec la note. Les avis anciens sont analysés par la tâche planifiée avec ce lexique, pour préserver le quota.
- **Code** : `src/modules/reviews/infrastructure/ai-analysis.ts` (modèle) · `src/modules/reviews/domain/analysis.ts` (règles et contrôle) · `POST /api/ai/reviews/analyze`.

### Repères techniques

| | |
|---|---|
| Modules | `reviews`, `support` |
| Pages | bloc avis de la fiche salon, `/dashboard/avis`, `/admin/moderation`, `/compte/support`, `/dashboard/support`, `/admin/support` |
| API | `/api/reviews/*`, `/api/ai/reviews/analyze`, `/api/support/*`, `/api/admin/support` |
| Collections | `Review`, `ReviewReport`, `SupportTicket` |
| Événements émis | `review.published` (la fidélité y réagit, gestion 5) |
| Tests | `loyalty-reviews`, `review-analysis`, `support` |

---

## 5. Gestion de l'espace client, de la fidélité et des abonnements (P5)

**But :** fidéliser les clientes avec un espace personnel et un programme de points, et gérer les plans payants des salons.

### Fonctionnalités

**Espace client** (`/compte`)
- Profil modifiable.
- Historique des rendez-vous, avec report et **« refaire le même rendez-vous »** en un clic.
- Factures.
- Favoris : salons et professionnels.
- **Notifications** : dans l'application (cloche) et **push** sur le téléphone.
- **E-mails réels** par SMTP quand il est configuré, sinon simulés.

**Fidélité — points Glowy**
- Points gagnés selon un **barème** réglable par le Super Admin. Par exemple :
  - rendez-vous terminé : +10 ;
  - nouveau salon : +30 ;
  - avis : +15 ;
  - heure creuse : +10 ;
  - parrainage : +50 ;
  - absence : −20.
- **Niveaux** : Bronze, Argent (200 points, +10 % sur les gains), Or (500 points, +20 %), Platine (1 000 points, +30 %), avec barre de progression.
- **Catalogue de récompenses** : un échange donne un code à présenter au salon.
- **Parrainage** avec un code personnel ; badges calculés selon l'activité.
- **Anti-fraude** : plafonds par jour et par mois.
- **Expiration** des points après 12 mois d'inactivité, avec un préavis un mois avant.
- Les points ne sont crédités **qu'après un rendez-vous terminé par le salon**. Chaque mouvement est inscrit dans un grand livre (`PointTransaction`).

**Abonnements des salons**
- Plans Gratuit, Pro (79 DT) et Premium (149 DT).
- Le gérant déclare son paiement (virement, D17 ou espèces). Le Super Admin l'accepte ou le refuse.
- Le plan accepté est actif **30 jours** et se renouvelle à partir de 7 jours avant l'échéance.
- **Limites appliquées par le serveur** : Gratuit 1 professionnel actif, Pro 8 (avec CRM, statistiques, promotions, vues semaine / mois, prévision d'affluence), Premium illimité (avec stocks, succursales, mise en avant dans la recherche). Une fonction non comprise affiche « Disponible avec le plan … ».
- **Échéance** : rappel au gérant 5 jours avant, puis retour automatique au plan Gratuit (tâche planifiée).
- La page `/pro` présente l'offre aux salons.

**Application installable (PWA) et langues**
- Installation sur l'écran d'accueil du téléphone.
- **Hors connexion** : les pages déjà vues et les pages publiques liées restent consultables. Les pages personnelles sont effacées à la déconnexion.
- Interface en **français, arabe (de droite à gauche) et anglais**.

### IA — Analyse beauté par photo

- **Entrée** : une photo des cheveux ou du visage, avec consentement.
- **Méthode** :
  - le navigateur mesure la photo (luminosité, netteté…) : une photo trop sombre ou floue est refusée **sans appel au modèle** ;
  - la photo, réduite à 768 px, est regardée par le **modèle de vision Gemini**, qui relève les points d'attention réellement visibles (cheveux : terne, frisottis, pointes sèches, racines ; visage : rougeurs, brillance, teint irrégulier, teint terne, pores, déshydratation), un indice de santé et une phrase d'explication ;
  - la photo n'est **jamais enregistrée** ni montrée aux salons (consentement explicite) ; si le modèle ne voit pas de visage ou de cheveux, une autre photo est demandée.
- **Sortie** :
  - conseils et **vraies prestations** des salons adaptés, dans l'ordre de la recommandation de la gestion 1 ;
  - pour une cliente connectée : le résultat enregistré dans son historique, et +10 points une fois par mois.
- **Message affiché** : « conseil indicatif, pas un diagnostic médical ».
- **Repli** : si le modèle ne répond pas, des **règles explicables** (seuils sur les mesures, rougeur lue dans la teinte CIELAB) donnent le diagnostic.
- **Code** : `src/modules/beauty/infrastructure/vision.ts` (modèle) · `src/modules/beauty/domain/analysis.ts` (mesures, règles, contrôle) · page `/analyse-beaute` · `POST /api/ai/beauty`.

### IA — Essai virtuel de couleur

- **Entrée** : une photo de face (caméra ou fichier) et une teinte parmi 12 (naturelles, chaudes, tendance), avec un curseur d'intensité.
- **Méthode** :
  - un **modèle de segmentation des cheveux** (MediaPipe *hair segmenter*, réseau de neurones de Google, licence Apache 2.0) s'exécute **dans le navigateur** (WebAssembly, carte graphique si possible) et donne, pixel par pixel, la probabilité « cheveux » ;
  - la teinte est appliquée dans l'espace CIELAB : la luminosité moyenne des cheveux glisse vers celle de la teinte, le relief (mèches, boucles) est gardé, les ombres restent dorées et non kaki, le fond pris dans le contour et les reflets de lumière gardent leur couleur (pas de halo) ;
  - comparaison avant / après par glissement, téléchargement de l'image, lien « Réserver une coloration » (salons qui proposent une coloration).
- **Confidentialité** : la photo **ne quitte jamais l'appareil** (aucun envoi, aucun enregistrement) ; pas de consentement à demander.
- **Pourquoi pas une IA générative ?** La génération d'images de Gemini (« Nano Banana ») a un quota gratuit de **0** (essai réel du 7 novembre 2026 : erreur 429 `limit: 0` sur les 6 modèles d'image) ; elle n'est utilisable qu'avec une clé payante.
- **Limites** : simulation indicative (couleur seulement, pas la coupe) ; mèches folles hors du masque, cheveux vus de dos ou couverts mal détectés (« Cheveux introuvables » sous 1,5 % de la photo) ; passer du noir au blond polaire donne un rendu plus gris que réel.
- **Fichiers** : moteur copié depuis `node_modules` vers `public/mediapipe` par `scripts/copy-mediapipe.mjs` (après `npm install` et avant `npm run build`, dossier non versionné), modèle `public/models/hair_segmenter.tflite` (780 Ko) ; premier essai ≈ 13 Mo à télécharger, ensuite en cache.
- **Code** : `src/modules/beauty/domain/try-on.ts` (teintes, recoloration, testé) · `src/components/ai/hair-try-on.tsx` · `src/components/ai/camera.tsx` (caméra partagée avec l'analyse beauté) · page `/essai-couleur`.

### Repères techniques

| | |
|---|---|
| Modules | `account`, `loyalty`, `notifications`, `subscription`, `beauty` |
| Pages | `/compte/*`, `/analyse-beaute`, `/essai-couleur`, `/pro`, `/dashboard/abonnement`, `/admin/abonnements`, `/offline` |
| API | `/api/me/*`, `/api/subscriptions`, `/api/admin/payments/*`, `/api/ai/beauty` |
| Collections | `User` (compte fidélité et favoris imbriqués), `PointRule`, `PointTransaction`, `PointCampaign`, `Reward`, `Redemption`, `PhotoAnalysis`, `Notification`, `PushSubscription`, `OutboxMessage`, `PlanPayment` |
| Événements écoutés | `booking.completed`, `booking.noShow`, `review.published`, `user.registered` |
| Tests | `loyalty-reviews`, `loyalty-admin`, `subscription`, `beauty`, `try-on`, `scheduler` |

---

## Comment les 5 gestions travaillent ensemble

Exemple : une cliente réserve, se rend au salon, puis laisse un avis.

```
Gestion 1 ─ connexion de la cliente, recommandation de salons
   │
Gestion 3 ─ réservation (verrou anti double réservation) ── booking.created ──► notifications (gestion 5)
   │                         ▲
   │                         └── heures creuses prévues (gestion 2) → +10 points
Gestion 2 ─ le salon voit le RDV dans l'agenda, puis le marque « terminé » ── booking.completed
   │                                                                              │
   │                                                       points crédités, niveau mis à jour (gestion 5)
Gestion 4 ─ la cliente laisse un avis vérifié, analysé par l'IA ── review.published ──► points d'avis (gestion 5)
   │
Gestion 1 ─ le Super Admin suit l'activité et modère un avis jugé suspect (gestion 4)
```

**Scénario de démonstration (5 minutes)** :
1. Photo → conseils (gestion 5).
2. Salon recommandé (gestion 1).
3. Réservation par le formulaire ou par l'assistante (gestion 3).
4. Le gérant voit le rendez-vous et la prévision d'affluence (gestion 2).
5. Avis vérifié résumé par l'IA, et points gagnés (gestions 4 et 5).
6. Le Super Admin suit l'activité et modère (gestions 1 et 4).
