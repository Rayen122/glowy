# API Glowy

Routes Next.js (`src/app/api`). Toutes les réponses sont en JSON :

- succès : `{ "data": … }`
- erreur : `{ "error": { "code": "SLOT_TAKEN", "message": "…", "details": [...] } }`

Les codes d'erreur sont stables : l'interface les traduit (`t.errors`). Validation des entrées avec Zod (`400 VALIDATION`).
Authentification par cookie de session Auth.js ; `401 UNAUTHORIZED` sans session, `403 FORBIDDEN` si le rôle ne convient pas.
Les requêtes d'écriture venant d'une autre origine sont refusées (`403`, protection CSRF).

Dates : `AAAA-MM-JJ`, heures : `HH:MM`, en heure de Tunis. Montants en dinars entiers.

## Authentification (P1)

| Méthode | Route | Accès | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | public | Inscription. `type: "client"` (actif tout de suite) ou `type: "salon"` (gérant + salon en attente de validation). `409 EMAIL_TAKEN` |
| GET/POST | `/api/auth/*` | public | Points d'accès Auth.js : `csrf`, `session`, `signout`, `callback/credentials`, `callback/demo` |

Connexion côté interface : `signIn("credentials", { email, password, redirect: false })` (codes `invalid_credentials`, `account_locked`, `account_blocked`).

## Salons et réservation (P3)

| Méthode | Route | Accès | Description |
| --- | --- | --- | --- |
| GET | `/api/salons?q=&ville=&categorie=&tri=` | public | Recherche (salons validés uniquement). `tri` : `recommande` · `note` · `prix` · `distance` |
| GET | `/api/salons/:slug` | public | Fiche : services groupés, équipe, horaires, avis vérifiés, répartition des notes |
| GET | `/api/salons/:slug/availability?date=&services=a,b&employee=` | public | Créneaux de 30 min avec les employés libres pour la durée totale des prestations |
| GET | `/api/bookings` | cliente | Historique de la cliente connectée |
| POST | `/api/bookings` | cliente | Réserver. `409 SLOT_TAKEN` si le créneau vient d'être pris |
| PATCH | `/api/bookings/:id` | cliente / salon | `{ action }` : voir ci-dessous |

Corps de `POST /api/bookings` :

```json
{
  "salonSlug": "salon-yasmine-la-marsa",
  "serviceKeys": ["coupe-brushing"],
  "employee": "any",
  "date": "2026-10-05",
  "time": "11:00",
  "paymentMethod": "ONLINE",
  "note": "Cuir chevelu sensible"
}
```

Actions de `PATCH /api/bookings/:id` :

| action | Qui | Effet |
| --- | --- | --- |
| `cancel` | cliente ou salon | Annule. Cliente à moins de `cancellationHours` du rendez-vous : annulation tardive, acompte conservé, −20 pts |
| `reschedule` + `date`, `time` | cliente | Déplace le rendez-vous (même employé, même durée) |
| `start` | salon | En cours |
| `complete` | salon | Terminé → événement `booking.completed` (points, droit à l'avis) |
| `noShow` | salon | Absente → −20 pts |

## Espace client (P5)

| Méthode | Route | Accès | Description |
| --- | --- | --- | --- |
| GET / PATCH | `/api/me` | connecté | Profil (CLI-01). Profil complet (téléphone, ville, date de naissance) : +20 pts une fois |
| PUT | `/api/me/favorites` | connecté | `{ salonSlug, favorite }` |
| GET / PATCH | `/api/me/notifications` | connecté | 30 dernières notifications ; PATCH = tout marquer comme lu |
| GET | `/api/me/loyalty` | cliente | Solde, cumul, niveau, historique, catalogue |
| POST | `/api/me/loyalty/redeem` | cliente | `{ rewardId }` → `{ code }`. `409 INSUFFICIENT_POINTS` |

## Avis (P4)

| Méthode | Route | Accès | Description |
| --- | --- | --- | --- |
| POST | `/api/reviews` | cliente | `{ bookingId, rating 1–5, text, photoUrl?, lang }` — uniquement après un rendez-vous terminé (`409 BOOKING_NOT_COMPLETED`, `409 ALREADY_REVIEWED`) |
| PATCH | `/api/reviews/:id` | selon l'action | `reply` (gérant) · `report` (tous) · `hide` / `keep` (Super Admin, journalisé) |

## Dashboard salon (P2)

| Méthode | Route | Accès | Description |
| --- | --- | --- | --- |
| GET | `/api/dashboard/agenda?date=` | gérant, employé, admin | Employés, rendez-vous et blocages du jour (le gérant ne voit que son salon) |

## Super Admin (P1)

| Méthode | Route | Accès | Description |
| --- | --- | --- | --- |
| GET | `/api/admin/overview` | admin | Chiffres clés, salons en attente, répartition des offres, journal d'audit |
| PATCH | `/api/admin/salons/:id` | admin | `{ action: approve · reject · suspend · reactivate, reason? }` — `approve` attribue le badge « Salon vérifié » |
| PATCH | `/api/admin/users/:id` | admin | `{ action: block · unblock }` — un compte bloqué perd l'accès immédiatement |

## Supervision

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/api/health` | État de l'application et de la base |

## Événements internes

Émis par les modules (`src/server/events.ts`), traités dans `src/server/subscribers.ts` :

| Événement | Émis par | Réactions |
| --- | --- | --- |
| `user.registered` | inscription | Notification de bienvenue |
| `salon.registered` | inscription salon | Notification aux Super Admins |
| `salon.statusChanged` | Super Admin | Notification + e-mail au gérant |
| `booking.created` | réservation | Notifications cliente et salon, e-mail et SMS (simulés) |
| `booking.cancelled` | annulation | Pénalité si tardive, notification |
| `booking.completed` | salon | Points : +10, +30 nouveau salon, paliers 3/5/10 salons, heure creuse, paiement en ligne, réservation 48 h à l'avance, parrainage |
| `booking.noShow` | salon | −20 pts |
| `review.published` | avis | +15 pts (+10 avec photo, 1 avis récompensé par salon et par mois), notification au salon |
