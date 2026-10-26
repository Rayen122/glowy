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
| 5 | Espace client, fidélité et abonnements | P5 | Analyse beauté par photo |

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
- **Les 5 IA** n'utilisent aucun service externe payant : ce sont des fonctions pures, explicables et testées. Chacune a un **repli** quand les données manquent.
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
- **Méthode** : un profil de goûts est construit à partir de l'historique. Chaque salon reçoit un **score** qui combine :
  - la ressemblance avec ce profil ;
  - sa qualité, calculée par une **note bayésienne** : un salon avec peu d'avis est ramené vers 4/5 ;
  - ses créneaux libres aujourd'hui.
- **Sortie** : une liste classée, avec **la raison affichée** (« même catégorie que vos visites », « bien noté », « disponible aujourd'hui »…).
- **Repli** : sans historique (visiteur ou nouveau compte), ce sont les salons les plus populaires.
- **Code** : `src/modules/catalog/domain/recommend.ts` · `GET /api/ai/recommendations`.

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
- **Repli** : sans historique suffisant (nouveau salon), une courbe type d'un salon de quartier est utilisée. La source est affichée honnêtement.
- **Code** : `src/modules/affluence/domain/forecast.ts` · `/api/salons/[slug]/live`, `/api/salons/[slug]/queue`.

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

- **Entrée** : une phrase libre en français, en arabe (darija courante comprise) ou en anglais. Par exemple : « je veux une coupe samedi après-midi à La Marsa ».
- **Méthode** : l'assistante repère la prestation, la date, le moment de la journée, l'heure et la ville. Elle répond aussi aux questions fréquentes. Elle cherche ensuite de **vrais créneaux libres** dans les salons les mieux adaptés, dans l'ordre de la recommandation de la gestion 1.
- **Sortie** : des créneaux réels proposés. La réservation n'est faite **qu'après confirmation explicite**, par l'API de réservation habituelle.
- **Repli** : une demande non comprise renvoie vers le formulaire de réservation.
- **Code** : `src/modules/assistant/domain/nlu.ts` · `POST /api/ai/chat`.

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

- **Avis vérifié** : possible seulement après un rendez-vous **terminé**, par la cliente concernée, une seule fois.
- Note de 1 à 5, commentaire et photo facultative.
- **Réponse du salon** à un avis, depuis `/dashboard/avis`.
- **Signalement** d'un avis par le salon ou par un utilisateur.
- **Modération** par le Super Admin (`/admin/moderation`) : il garde ou masque l'avis. La **décision finale est toujours humaine**.
- **Badge « Salon vérifié »** après validation du justificatif (gestion 1).
- **Support** : tickets ouverts par les clientes (`/compte/support`) et les salons (`/dashboard/support`), traités par le Super Admin (`/admin/support`).

### IA — Analyse des avis

- **Entrée** : le texte et la note de chaque avis.
- **Méthode** :
  - **sentiment** calculé avec un lexique français, anglais et arabe (darija comprise) qui tient compte des négations et des emojis, puis croisé avec la note ;
  - **aspects** : accueil, résultat, attente, prix, propreté, conseil et ponctualité, chacun jugé positif ou négatif ;
  - **score de suspicion** de 0 à 100 : texte creux, note incohérente avec le texte, liens…
- **Sorties** :
  - sur la fiche du salon : la synthèse (répartition des sentiments, points forts, points à améliorer) ;
  - pour la modération : les avis suspects envoyés en file.
- **Repli** : si le texte ne contient aucun indice, le sentiment vient de la note seule. Les avis anciens sont analysés par la tâche planifiée.
- **Code** : `src/modules/reviews/domain/analysis.ts` · `POST /api/ai/reviews/analyze`.

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
  - mesures calculées **dans le navigateur** à partir des pixels (luminosité, contraste, saturation, reflets, rougeurs, netteté, différence racines/pointes) : **la photo ne quitte jamais l'appareil** ;
  - des **règles explicables** (seuils) en déduisent les points d'attention. Pour les cheveux : terne, frisottis, pointes sèches, racines. Pour le visage : rougeurs, brillance, teint irrégulier, pores, déshydratation.
- **Sortie** :
  - conseils et **vraies prestations** des salons adaptés, dans l'ordre de la recommandation de la gestion 1 ;
  - pour une cliente connectée : le résultat enregistré dans son historique, et +10 points une fois par mois.
- **Message affiché** : « conseil indicatif, pas un diagnostic médical ».
- **Repli** : si la photo est trop sombre ou floue, une nouvelle photo est demandée.
- **Code** : `src/modules/beauty/domain/analysis.ts` · page `/analyse-beaute` · `POST /api/ai/beauty`.

### Repères techniques

| | |
|---|---|
| Modules | `account`, `loyalty`, `notifications`, `subscription`, `beauty` |
| Pages | `/compte/*`, `/analyse-beaute`, `/pro`, `/dashboard/abonnement`, `/admin/abonnements`, `/offline` |
| API | `/api/me/*`, `/api/subscriptions`, `/api/admin/payments/*`, `/api/ai/beauty` |
| Collections | `User` (compte fidélité et favoris imbriqués), `PointRule`, `PointTransaction`, `PointCampaign`, `Reward`, `Redemption`, `PhotoAnalysis`, `Notification`, `PushSubscription`, `OutboxMessage`, `PlanPayment` |
| Événements écoutés | `booking.completed`, `booking.noShow`, `review.published`, `user.registered` |
| Tests | `loyalty-reviews`, `loyalty-admin`, `subscription`, `beauty`, `scheduler` |

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
