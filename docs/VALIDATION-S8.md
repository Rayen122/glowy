# Validation S8 — Modern Mobile Application : préparation de la démo

Consignes (e-mail du 19 octobre 2026) : une **PWA** avec mode hors ligne, manifest installable et interface mobile first / responsive ; présentation des **opérations CRUD** sur nos entités et de leur logique métier ; en bonus, l'**intégration des modules d'IA**.

État vérifié le 23 octobre 2026 sur le build de production, avec Chrome.

| Exigence | État | Preuve |
|---|---|---|
| Mode hors ligne | ✅ | Service worker `public/sw.js`. Testé en mode avion : une fiche salon jamais ouverte, la navigation par liens et « Mes rendez-vous » fonctionnent ; une page non enregistrée affiche `/offline` |
| Manifest installable | ✅ | `src/app/manifest.ts`. Chrome ne signale **aucune erreur d'installabilité** (nom, icônes 192 / 512 / maskable, `display: standalone`, raccourcis) |
| Mobile first et responsive | ✅ | Aucun débordement à 375 px (téléphone) ni à 768 px (tablette), sur les pages publiques, l'espace client, le dashboard et l'admin. Bannière d'installation adaptée au téléphone |
| CRUD et logique métier | ✅ | Voir le tableau par personne ci-dessous |
| Bonus : IA | ✅ | Les 5 IA sont intégrées et fonctionnelles, chacune avec un repli |

---

## Avant la séance : préparer la machine

> **Important.** Le hors-ligne ne marche **qu'avec le build de production**, pas avec `npm run dev`. De plus, le service worker ne s'installe que sur `localhost` ou en HTTPS. Une adresse comme `http://10.x.x.x:3000`, ouverte sur un téléphone, ne donne ni installation ni hors-ligne.

1. Lancer MongoDB, puis les données de démo :
   ```bash
   npm run db:seed
   ```
2. Construire et lancer la version de production. Arrêter `npm run dev` avant, sinon le port 3000 est occupé :
   ```bash
   npm run build && npm start
   ```
3. Ouvrir http://localhost:3000 dans **Chrome**. Visiter l'accueil et `/salons`, puis attendre environ 5 secondes : les pages s'enregistrent pour le hors-ligne.
4. Se connecter avec les boutons « Accès démo par rôle » de la page de connexion : Client, Gérant, Employé, Super Admin.

**Montrer sur un vrai téléphone Android (facultatif)** : brancher le téléphone en USB. Dans Chrome sur l'ordinateur, ouvrir `chrome://inspect`, puis *Port forwarding* et ajouter `3000 → localhost:3000`. Ouvrir ensuite `localhost:3000` dans Chrome sur le téléphone. Sinon, le mode appareil des DevTools suffit.

---

## Démo PWA (environ 3 minutes)

1. **Manifest** : DevTools, onglet Application, section Manifest. On y voit le nom, les icônes, `standalone`, les raccourcis et la couleur.
2. **Installation** :
   - sur téléphone : bannière « Installer Glowy » ;
   - sur ordinateur : icône d'installation dans la barre d'adresse.

   L'application s'ouvre alors dans sa propre fenêtre, sans barre de navigateur.
3. **Service worker** : onglet Application, section Service workers, qui montre `sw.js` en état *activated*. La section Cache storage montre les caches `bh-pages-v3`, `bh-private-v3` et `bh-static-v3`.
4. **Hors ligne** : onglet Network, cocher **Offline**.
   - Le message « Connexion perdue » reste affiché.
   - Ouvrir une fiche salon, cliquer sur des liens, ouvrir « Mes rendez-vous » : tout s'affiche depuis l'appareil.
   - Ouvrir une page jamais enregistrée, par exemple le tunnel de réservation : la page *Vous êtes hors ligne* liste les pages disponibles.
   - Décocher Offline : le message « Connexion rétablie » apparaît.
5. **Responsive** : mode appareil des DevTools, à 375 px, 768 px puis 1280 px.
   - Même contenu sur téléphone et ordinateur : il est réorganisé, pas masqué.
   - Barre « Réserver » fixe en bas sur téléphone.
   - Champs de saisie d'au moins 16 px, pour éviter le zoom automatique sur iPhone.
   - Arabe de droite à gauche (bouton FR / AR / EN).
6. **Sécurité de la PWA** : les pages personnelles enregistrées sont **effacées à la déconnexion**. Aucune donnée privée ne reste sur un appareil partagé.

---

## CRUD et logique métier, par personne

C = créer · R = lire · U = modifier · D = supprimer.

| Personne | Entité | Opérations | Où le montrer | Logique métier à expliquer |
|---|---|---|---|---|
| **P1** | Utilisateurs | R, U (bloquer / débloquer, lien de réinitialisation) | `/admin/utilisateurs` | blocage 15 min après 5 échecs de connexion ; un compte bloqué perd l'accès aussitôt ; action inscrite au journal d'audit |
| | Salons | R, U (valider, refuser, suspendre, réactiver) | `/admin/salons` | un salon en attente n'apparaît pas dans la recherche ; badge « Vérifié » après validation |
| | Campagnes « double points » | **C, R, U, D** | `/admin/fidelite` | multiplicateur appliqué aux gains pendant la période |
| **P2** | Prestations | **C, R, U, D** | `/dashboard/services` | durée multiple de 5 min (grain du verrou) ; ancien prix barré pour les promos |
| | Équipe (employés) | **C, R, U, D**, plus comptes et congés | `/dashboard/equipe` | un congé bloque l'agenda ; commission par professionnel |
| | Promotions | **C, R, U, D** | `/dashboard/promotions` | période, nombre d'utilisations, montant minimum, dernière minute |
| | Stocks | **C, R, U, D**, plus mouvements | `/dashboard/stocks` | alerte de stock bas |
| | Factures (caisse) | C, R, D | `/dashboard/caisse` | numérotation continue des factures |
| **P3** | Réservations | C, R, U (report, statut), D = **annulation** | fiche salon → réserver, puis `/compte/rendez-vous` et `/dashboard/agenda` | **anti double réservation** (index unique sur des tranches de 5 min : 10 réservations simultanées, 1 seule acceptée) ; réservation au moins 15 min à l'avance ; acompte de 20 % borné entre 10 et 30 DT ; annulation tardive selon le délai du salon. L'annulation garde l'historique au lieu d'effacer |
| | Liste d'attente | C, R, D | jour complet sur la fiche salon | prévenue une seule fois quand une annulation libère un créneau |
| **P4** | Avis | C, R, U (réponse du salon, signalement, modération) | fiche salon, `/dashboard/avis`, `/admin/moderation` | avis possible seulement après un RDV **terminé**, une seule fois ; la décision de modération reste humaine |
| | Tickets de support | C, R, U (réponse, clôture) | `/compte/support`, `/admin/support` | — |
| **P5** | Profil | R, U | `/compte/profil` | +20 points quand le profil est complet |
| | Favoris | C, R, D | cœur sur une fiche salon, puis `/compte/favoris` | — |
| | Récompenses et points | R, C (échange) | `/compte/fidelite` | points crédités seulement après un RDV terminé ; niveaux Bronze à Platine avec bonus ; plafonds anti-fraude ; expiration à 12 mois |
| | Abonnements des salons | C (déclaration), R, U (accepter / refuser) | `/dashboard/abonnement`, `/admin/abonnements` | plan actif 30 jours, renouvelable 7 jours avant l'échéance |

Les routes API correspondantes sont listées dans [`API.md`](API.md). Les règles et les entités sont décrites dans [`GESTIONS.md`](GESTIONS.md) (ou `GESTIONS.pdf`).

---

## Bonus : les 5 IA intégrées

| Personne | IA | Où la montrer |
|---|---|---|
| P1 | Recommandation de salons avec la raison affichée | accueil, `/compte`, et tri « Recommandé pour vous » sur `/salons` |
| P2 | Prédiction d'affluence, heures creuses (+10 points) | `/dashboard` (prévision de la semaine), affluence en direct sur la fiche salon |
| P3 | Assistante de réservation (français, darija, anglais) | bouton « Réserver avec l'assistante » |
| P4 | Analyse des avis : sentiment, points forts et faibles, suspicion | fiche salon (synthèse), `/admin/moderation` (avis suspects) |
| P5 | Analyse beauté par photo, calculée sur l'appareil | `/analyse-beaute` |

---

## Questions probables du jury

- **Pourquoi le site marche-t-il hors ligne ?** Un service worker intercepte les requêtes.
  - Pages : réseau d'abord, copie enregistrée si le réseau ne répond pas ou met plus de 4 s.
  - Fichiers versionnés : cache d'abord.
  - API : réseau seulement, car réserver ou payer demande une connexion.
- **Que se passe-t-il pour une page jamais vue ?** La page `/offline` s'affiche, avec la liste des pages disponibles.
- **Et les données privées ?** Elles sont dans un cache séparé, effacé à la déconnexion, à la connexion d'un autre compte et quand la session expire.
- **Comment éviter deux réservations sur le même créneau ?** Par un index unique MongoDB sur (employé, tranche de 5 min). La deuxième insertion échoue, même si les deux requêtes arrivent en même temps.
- **Mobile first ?** Les styles sont écrits pour le téléphone d'abord, puis élargis avec les points de rupture Tailwind (`sm`, `md`, `lg`). Les cibles tactiles font au moins 44 px et les zones sûres de l'iPhone sont respectées (`env(safe-area-inset-*)`).
