# Script de démonstration (soutenance, 10 à 12 minutes)

Déroulé fidèle au §14.1 du cahier des charges. Chaque étape indique **où aller**, **quoi faire** et **quoi dire** (le point à faire valoir devant le jury).

## Préparation (la veille, puis 15 minutes avant)

1. Base de démonstration propre : `npm run db:seed` (vide puis remplit la base de dev : 3 agences, une dizaine de circuits, environ 160 départs, 500 réservations, 200 avis).
2. Build de production : `npm run build` puis `npm start` (plus rapide et plus stable que `npm run dev`).
3. Ouvrir **trois fenêtres de navigation privée** (sessions séparées) : 1) visiteur / client, 2) administrateur Green Trek Mada, 3) autre agence puis super admin.
4. Vérifier Internet (tuiles OpenStreetMap). **Plan B** : captures d'écran et vidéo de secours (§12), dans l'ordre de ce script.
5. Zoom du navigateur à 110 % environ pour le vidéoprojecteur.

Mot de passe de tous les comptes : `Demo2026!`

| Rôle | Compte |
|---|---|
| Administrateur Green Trek Mada | `admin@green-trek-mada.test` |
| Personnel Green Trek Mada | `staff@green-trek-mada.test` |
| Client Green Trek Mada | `client@green-trek-mada.test` (connexion sur le site de l'agence) |
| Administrateur Tanety Trek (autre agence) | `admin@tanety-trek.test` |
| Super admin | `superadmin@greentrek-saas.test` |

## Déroulé

### 1. Landing SaaS et inscription d'une agence (1 min 30)

- `/` : présenter la plateforme, puis `/tarifs` (plans lus en base).
- `/inscription-agence` : créer « Agence Soutenance » (e-mail en `@example.com`).
- Arrivée sur le tableau de bord vide, plan **Essai**.
- **À dire** : une inscription crée en une transaction l'agence, son administrateur et un abonnement d'essai. Chaque agence est un *tenant* isolé (base partagée, discriminant `agenceId`).

### 2. Tableau de bord de Green Trek Mada (1 min)

- Fenêtre 2 : `/connexion` avec `admin@green-trek-mada.test`.
- Montrer les indicateurs (réservations du mois, montants, taux de remplissage), le bandeau « À traiter », la cloche des notifications.
- **À dire** : les indicateurs sont calculés sur les données en base ; le rôle détermine le menu (matrice des permissions §3), et chaque page revérifie les droits côté serveur.

### 3. Éditeur de graphe (1 min)

- « Carte du réseau » : les étapes (nœuds) et les tronçons (arêtes).
- Ouvrir un lieu, montrer ses tronçons ; mentionner les distances estimées (Haversine × sinuosité 1,3) signalées à l'écran.
- **À dire** : le réseau de sentiers est un graphe pondéré commun à l'agence ; une étape est réutilisable entre circuits.

### 4. Calcul d'itinéraire : Dijkstra contre A* (2 min, cœur du mémoire)

- « Calcul d'itinéraire » : choisir un départ et une arrivée éloignés, critère « Plus court ».
- Cliquer « Comparer Dijkstra et A* » : même coût, **moins de nœuds explorés** pour A*.
- « Performances » : graphiques sur des graphes de 50 à 5 000 nœuds.
- **À dire** : A* reste exact car son heuristique (distance de Haversine) est admissible, elle ne surestime jamais le coût restant ; les deux algorithmes sont testés sur des graphes aléatoires (coûts identiques).

### 5. Création d'un départ (45 s)

- « Départs » → « Programmer un départ » sur un circuit publié, dans trois semaines, 8 places.
- **À dire** : RG 10 (date de fin ≥ date de début) ; le départ passera « Complet » tout seul quand toutes les places seront prises (RG 11), et la limite du plan est vérifiée (RG 18).

### 6. Côté client : site vitrine, recherche, réservation, paiement (2 min 30)

- Fenêtre 1 : `/a/green-trek-mada`. Montrer le hero, les cartes de circuits **avec leur note**, les avis des voyageurs.
- Rechercher une date et 2 voyageurs, ouvrir le circuit du départ créé, « Réserver ».
- Se connecter avec `client@green-trek-mada.test`, saisir les participants, valider le récapitulatif.
- Paiement : **astuce** : un numéro de carte finissant par `0000` est refusé (montrer le refus), puis payer avec un autre numéro → confirmation avec la **référence**.
- **À dire** : la réservation verrouille la ligne du départ dans une transaction : deux réservations simultanées ne peuvent pas dépasser les places (RG 13, testé en simultané). Le montant est figé à la création (RG 14).

### 7. Retour au back-office (1 min)

- Fenêtre 2 : la cloche affiche « Nouvelle réservation » ; cliquer → fiche de la réservation, paiement validé, facture avec QR code.
- **Avis** : dans l'espace client (fenêtre 1), « Mes réservations » → un séjour terminé → « Donner mon avis » (note et commentaire). Dans le back-office, menu « Avis » → « Publier » : la note apparaît sur le site.
- **À dire** : RG 17 (avis seulement après un séjour terminé, un par réservation) ; modération avant publication ; « Journal d'activité » : qui a fait quoi, et quand.

### 7 bis. Messagerie en temps réel (1 min)

- Fenêtre 1 (client) : sur la réservation qui vient d'être faite, « Contacter l'agence », écrire une question.
- Fenêtre 2 (agence, déjà ouverte sur « Messages ») : le son retentit, la notification et la pastille apparaissent aussitôt ; ouvrir la conversation, répondre avec Entrée.
- Fenêtre 1 : la réponse apparaît dans le fil **sans recharger**.
- **À dire** : canal Server-Sent Events (standard du navigateur) ; l'événement n'est envoyé qu'après la validation de la transaction ; chacun ne voit que ses conversations (client, guide de ses départs, équipe de l'agence) ; le son est sous licence CC0.
- **Astuce** : cliquer une fois dans chaque fenêtre avant de commencer (les navigateurs ne jouent un son qu'après une interaction).

### 8. Preuve d'isolation (1 min)

- Fenêtre 3 : `admin@tanety-trek.test`. Ni la réservation ni le départ créés ne sont visibles.
- Coller dans cette fenêtre l'adresse de la fiche de réservation de Green Trek (copiée depuis la fenêtre 2) : **page introuvable**.
- **À dire** : toute requête passe par le client Prisma confiné (`getTenantDb`), qui ajoute le filtre `agenceId` ; des tests d'isolation automatisés le vérifient (lecture, modification, suppression, relations).

### 9. Console super admin (1 min)

- Fenêtre 3 : se déconnecter, puis `superadmin@greentrek-saas.test`. Liste des agences, fiche de « Agence Soutenance ».
- Attribuer le plan Pro ; **suspendre** l'agence → son site renvoie 404 et son équipe est déconnectée (RG 19) ; la réactiver.
- **À dire** : la suspension prend effet immédiatement, car la session est relue en base à chaque requête.

## Après la démonstration

Relancer `npm run db:seed` pour retrouver la base de départ (l'agence créée pendant la démo est supprimée).
