# Glowy — Dossier P2 : Dashboard du salon

Ce dossier explique le projet en détail, puis **ta gestion** : ce qu'elle fait, ses règles métier, son IA, les fichiers à connaître et comment la présenter à la validation.

## Le projet Glowy en détail

### 1. Qu'est-ce que Glowy ?

Glowy est une **plateforme de réservation de salons de beauté vérifiés en Tunisie** (coiffure, barbier, ongles, spa, visage…). Une cliente cherche un salon, voit les prestations, les prix en dinars, les avis et l'affluence, puis réserve un créneau précis en moins de 2 minutes. Le salon gère tout son travail depuis un tableau de bord, et un Super Admin contrôle la plateforme.

- **4 rôles** : cliente, employé, gérant de salon, Super Admin.
- **3 langues** : français, arabe (écriture de droite à gauche) et anglais.
- **Application installable** sur téléphone (PWA), utilisable hors connexion.
- **5 intelligences artificielles**, une par membre de l'équipe.
- Projet d'équipe de 5 étudiants : chaque personne a **1 gestion classique + 1 IA**.

### 2. Les technologies

| Domaine | Technologie | Rôle dans le projet |
|---|---|---|
| Langage | **TypeScript** | partout : pages, API, règles métier, tests |
| Framework | **Next.js 16** (App Router) + **React 19** | site et API dans un seul projet |
| Interface | **Tailwind CSS 4**, composants shadcn / Base UI | mise en page responsive, mobile first |
| Animations | **GSAP** | apparitions et transitions |
| Base de données | **MongoDB** + **Mongoose 9** | 33 collections (comptes, salons, réservations, avis, points…) |
| Authentification | **Auth.js v5** | connexion e-mail / mot de passe, Google, sessions sécurisées |
| Validation | **Zod** | contrôle de toutes les données reçues par l'API |
| Carte | **Leaflet** + OpenStreetMap | carte des salons |
| Graphiques | **Recharts** | statistiques du dashboard |
| E-mails | **nodemailer** (SMTP) | mot de passe oublié, rappels |
| Notifications | **Web Push** | rappels sur le téléphone |
| Tests | **node:test** + tsx | 75 tests automatisés sur une base de test |

### 3. L'architecture

Le code suit une **architecture propre (Clean Architecture)** : chaque domaine est un **module** indépendant dans `src/modules/<module>/`, découpé en 3 couches.

| Couche | Contenu | Exemple |
|---|---|---|
| `domain` | règles métier pures, sans base de données, faciles à tester | calcul de l'acompte, verrou des créneaux |
| `application` | cas d'usage et validation des données (Zod) | « créer une réservation » |
| `infrastructure` | lecture et écriture dans MongoDB | requêtes Mongoose |

Organisation des dossiers :

```
src/
  app/              pages et routes API (Next.js)
    (site)/         site public + espace client (/compte)
    (auth)/         connexion, inscription, mot de passe oublié
    dashboard/      espace du salon (gérant, employés)
    admin/          espace Super Admin
    api/            routes REST
  modules/          un dossier par domaine (identity, booking, reviews, loyalty…)
  components/       composants d'interface
  core/domain/      règles communes (erreurs, heure de Tunis, événements)
  infrastructure/   connexion MongoDB, sessions, outils HTTP
  i18n/             traductions français / arabe / anglais
public/sw.js        service worker (hors connexion, notifications)
tests/              tests automatisés
```

**Les modules communiquent par événements.** Exemple : quand le salon marque un rendez-vous « terminé », le module réservation publie `booking.completed`. Le module fidélité y réagit en créditant les points, et le module notifications prévient la cliente. Aucun module ne modifie le code d'un autre.

**Tâches planifiées** (toutes les 10 minutes) : rappels de rendez-vous, préavis et expiration des points, analyse des nouveaux avis.

### 4. La base de données

MongoDB stocke les données sous forme de documents. Les données qui vivent toujours avec leur parent sont **imbriquées** : les horaires et les prestations dans le salon, les lignes et le paiement dans la réservation, le compte fidélité dans l'utilisateur.

| Collection | Contenu |
|---|---|
| `User` | comptes (rôle, mot de passe haché, points, favoris) |
| `Salon` | salons (adresse, horaires, photos, prestations, plan) |
| `Employee`, `TimeOff` | équipe et congés |
| `Booking` | réservations (prestations, statut, acompte) |
| `SlotLock` | verrou anti double réservation (tranches de 5 min) |
| `Review`, `ReviewReport` | avis et signalements |
| `PointTransaction`, `Reward`, `Redemption` | fidélité |
| `Notification`, `PushSubscription` | notifications |
| `PlanPayment` | abonnements des salons |
| `AuditLog` | journal des actions sensibles |

### 5. La sécurité

- Mots de passe hachés (bcrypt) ; compte bloqué 15 minutes après 5 échecs.
- Rôle vérifié sur **chaque page et chaque API**.
- Protection CSRF : une écriture venant d'un autre site est refusée.
- Toutes les données reçues sont validées (Zod) avant d'arriver en base.
- Les actions sensibles du Super Admin sont journalisées.

### 6. L'application mobile (PWA)

- **Manifest** : nom, icônes, mode plein écran, raccourcis. L'application s'installe sur l'écran d'accueil.
- **Mode hors connexion** : le service worker enregistre les pages consultées et précharge les pages publiques liées. Sans réseau, elles s'ouvrent depuis le téléphone ; sinon la page `/offline` liste les pages disponibles. Les pages personnelles sont effacées à la déconnexion.
- **Mobile first et responsive** : testé de 320 à 1440 px de large, en français, en arabe et en anglais, sans aucun débordement.

### 7. Lancer le projet

```
npm install
npm run db:seed        données de démonstration
npm run dev            développement : http://localhost:3000
npm run build && npm start      production (nécessaire pour le hors connexion)
npm test               75 tests automatisés
```

Sur la page de connexion, les boutons **« Accès démo par rôle »** connectent en un clic : Client, Gérant, Employé, Super Admin.

### 8. Les 5 gestions

| # | Gestion | Responsable | IA associée |
|---|---|---|---|
| 1 | Comptes, sécurité et Super Admin | P1 | Recommandation de salons |
| 2 | Dashboard du salon | P2 | Prédiction d'affluence |
| 3 | Recherche et réservation | P3 | Assistante de réservation |
| 4 | Avis, modération et support | P4 | Analyse des avis |
| 5 | Espace client, fidélité, abonnements et PWA | P5 | Analyse beauté par photo |

**Un parcours complet relie les 5 gestions** :
1. La cliente se connecte et voit des salons recommandés (gestion 1).
2. Elle réserve un créneau (gestion 3).
3. Le salon voit le rendez-vous dans son agenda et le marque terminé (gestion 2).
4. La cliente gagne des points (gestion 5) et laisse un avis vérifié, analysé par l'IA (gestion 4).
5. Le Super Admin suit l'activité et modère (gestion 1).

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

## Ma préparation pour la validation

### Fichiers à connaître
- `src/modules/dashboard/`, `src/modules/promotions/`, `src/modules/affluence/`
- Pages : `src/app/dashboard/*` · API : `src/app/api/dashboard/*`
- Composants : `src/components/dashboard/*`, `src/components/manage/*`, `src/components/charts/*`
- IA : `src/modules/affluence/domain/forecast.ts` · tests : `tests/dashboard.test.ts`, `tests/cashier.test.ts`, `tests/stocks.test.ts`, `tests/affluence.test.ts`

### Démo (3 minutes)
Connexion démo **Gérant**, puis :
1. **Prestations** (`/dashboard/services`) : créer, modifier le prix, désactiver, supprimer — CRUD complet.
2. **Équipe** (`/dashboard/equipe`) : ajouter un employé, ses horaires, un congé (qui bloque l'agenda).
3. **Agenda** (`/dashboard/agenda`) : vues jour / semaine / mois, une couleur par employé.
4. **Promotions** et **Stocks** : CRUD complet, alerte de stock bas.
5. **Statistiques** : chiffre d'affaires réel, export Excel / PDF.

### Montrer l'IA
- Où la montrer : `/dashboard` (prévision de la semaine), affluence en direct sur la fiche salon, file d'attente.

### Règles métier à savoir expliquer
- Durée d'une prestation : multiple de 5 min (grain du verrou anti double réservation).
- Congé ou créneau bloqué = l'agenda n'accepte plus de réservation sur ce créneau.
- Promotion : période, nombre d'utilisations, montant minimum, offres de dernière minute.
- Factures numérotées sans trou ; commission par professionnel.

### Questions probables du jury
- *Le gérant voit-il les autres salons ?* Non, chaque requête est limitée à son salon (`staffSalon`).
- *Pourquoi pondérer les semaines ?* Une semaine récente reflète mieux l'activité actuelle qu'il y a 2 mois.
