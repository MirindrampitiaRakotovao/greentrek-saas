# Green Trek SaaS

Plateforme SaaS multi-agences de gestion et de réservation de circuits de randonnée, avec optimisation d'itinéraires (Dijkstra, A\*). Projet de fin d'études, Master 2, ENI Fianarantsoa. Cas d'étude et première agence utilisatrice : **Green Trek Mada** (Mahambo).

Ce document est le **guide pas à pas de la démonstration** : qui se connecte, dans quelle fenêtre, où cliquer, ce qui doit apparaître à l'écran et ce qu'il faut dire au jury. Durée visée : **12 minutes environ**.

> Documents liés : cahier des charges `docs/CAHIER_DES_CHARGES.md`, suivi `docs/AVANCEMENT.md`, version courte du déroulé `docs/SCRIPT_DEMO.md`.

---

## 1. Lancer la plateforme

**Une seule fois (installation)** : `cp .env.example .env`, puis `mysql -u root -p < scripts/init-db.sql`, puis `npm install` et `npm run db:migrate`.

**Avant chaque répétition et le jour J** :

```bash
npm run db:seed     # remet la base de démonstration à zéro (3 agences, ~500 réservations, avis, messages)
npm run build       # version de production : plus rapide et plus stable que le mode développement
npm start           # http://localhost:3000
```

Vérifier que <http://localhost:3000/api/health> répond `"database": "connectée"`.

---

## 2. Les personnages de la démo

Mot de passe de **tous** les comptes : `Demo2026!`

| Personnage | Rôle dans la plateforme | Compte | Page de connexion |
|---|---|---|---|
| Hanta Razafimahefa | Administratrice de Green Trek Mada | `admin@green-trek-mada.test` | `/connexion` |
| Mamy Andrianarisoa | Personnel de Green Trek Mada | `staff@green-trek-mada.test` | `/connexion` |
| Tahina Rasolofo | Guide de Green Trek Mada | `guide@green-trek-mada.test` | `/connexion` |
| Nirina Randriamanana | Voyageuse, cliente de Green Trek Mada | `client@green-trek-mada.test` | `/a/green-trek-mada/connexion` |
| Andry Rakotoarivelo | Administrateur de **Tanety Trek** (autre agence) | `admin@tanety-trek.test` | `/connexion` |
| Fanomezantsoa Rakotoarisoa | Super admin de la plateforme | `superadmin@greentrek-saas.test` | `/connexion` |

À retenir : le **personnel** (administrateur, personnel, guide) se connecte sur `/connexion`. Un **voyageur** se connecte sur le site de **son** agence (`/a/<agence>/connexion`).

---

## 3. Préparer trois fenêtres (sessions séparées)

Chaque fenêtre doit avoir **sa propre session**. Attention : dans Chrome, toutes les fenêtres de navigation privée **partagent la même session**. Utiliser plutôt :

| Fenêtre | Navigateur | Pour qui |
|---|---|---|
| **A, « Agence »** | Chrome, fenêtre normale | Hanta, administratrice de Green Trek Mada |
| **B, « Voyageur »** | Chrome, **fenêtre privée** | le visiteur, puis Nirina, cliente |
| **C, « Plateforme »** | **Safari** (ou Firefox) | la nouvelle agence, Tanety Trek, puis le super admin |

Puis :

1. **A** : se connecter avec `admin@green-trek-mada.test` sur `http://localhost:3000/connexion`. Laisser ouvert le **Tableau de bord**.
2. **B** : ouvrir `http://localhost:3000/a/green-trek-mada` (site vitrine), **sans** se connecter.
3. **C** : ouvrir `http://localhost:3000` (page d'accueil de la plateforme).
4. **Cliquer une fois dans chaque fenêtre** : les navigateurs ne jouent les sons des notifications qu'après une première interaction avec la page.
5. Zoom à 110 % environ pour le vidéoprojecteur. Placer A et B côte à côte pour les actes 6 et 8.

---

## 4. Le scénario, acte par acte

### Acte 1 : la plateforme et l'inscription d'une agence (1 min 30)

**Qui** : un responsable d'agence qui découvre la plateforme. **Fenêtre C.**

1. Sur la page d'accueil, montrer les atouts, puis le menu **Tarifs** (plans Essai, Pro, Entreprise).
2. Cliquer **Inscrire mon agence** (en haut à droite), ou **Essai gratuit de 30 jours**.
3. Remplir :
   - Nom de l'agence : `Agence Soutenance` (l'identifiant `agence-soutenance` se remplit tout seul) ;
   - Prénom, Nom : les vôtres ;
   - Adresse e-mail : `admin@agence-soutenance.test` ;
   - Mot de passe et confirmation : `Soutenance2026` (8 caractères, une majuscule, une minuscule, un chiffre).
4. Cliquer **Créer mon agence (essai de 30 jours)**.

**À l'écran** : le tableau de bord, vide, de la nouvelle agence, en plan d'essai.

**À dire** : « En une étape, la plateforme crée l'agence, son administrateur et un abonnement d'essai, dans une seule transaction. Chaque agence est un *tenant* : les données sont dans une base partagée, mais chaque ligne porte l'identifiant de son agence, et toutes les requêtes sont filtrées automatiquement. »

---

### Acte 2 : le tableau de bord de Green Trek Mada (1 min)

**Qui** : Hanta, administratrice de Green Trek Mada. **Fenêtre A.**

1. Montrer les indicateurs : réservations du mois, montants, taux de remplissage, prochains départs.
2. Montrer le bandeau **À traiter** (réservations en attente, paiements à valider, avis à modérer).
3. Montrer la **cloche** des notifications et la pastille du menu **Messages**.

**À dire** : « Les chiffres sont calculés sur les données en base. Le menu dépend du rôle : un guide ne voit ni les paiements ni l'équipe. Chaque page revérifie les droits côté serveur : masquer un lien n'est qu'un confort. »

---

### Acte 3 : le réseau de sentiers, un graphe (1 min)

**Qui** : Hanta. **Fenêtre A.**

1. Menu **Carte du réseau**. L'onglet **Étapes** montre les lieux de la côte Est.
2. Cliquer l'onglet **Tronçons** : les sentiers reliant les lieux. Les tronçons à distance estimée sont signalés.
3. Cliquer sur **Mahambo** sur la carte : sa fiche (tronçons, circuits qui y passent).

**À dire** : « Le réseau est un graphe pondéré. Les étapes sont les nœuds, les tronçons sont les arêtes. Sans mesure de terrain, la distance est estimée par la formule de Haversine multipliée par un coefficient de sinuosité de 1,3, et l'interface l'indique. »

---

### Acte 4 : le calcul d'itinéraire, Dijkstra contre A\* (2 min, cœur du mémoire)

**Qui** : Hanta. **Fenêtre A.**

1. Menu **Calcul d'itinéraire**.
2. Départ : **Soanierana Ivongo**. Arrivée : **Antetezambaro** (tout le réseau, du nord au sud).
3. Critère : **Plus court**. Algorithme : **Comparer**.
4. Cliquer **Comparer Dijkstra et A\***.

**À l'écran** : le tracé sur la carte, puis le tableau de comparaison. Le **coût est identique**, mais A\* explore **moins de nœuds**, ce qu'on voit aussi sur la carte.

5. Changer l'arrivée pour **Ambodifototra** (île Sainte-Marie) et relancer : message « Aucun chemin entre … : ces étapes ne sont reliées par aucune suite de tronçons. »
6. Menu **Performances** : cliquer **Lancer le banc d'essai** et montrer les graphiques (temps et nœuds explorés selon la taille du graphe).

**À dire** : « A\* reste exact parce que son heuristique, la distance à vol d'oiseau, ne surestime jamais le coût restant : elle est admissible. Les deux algorithmes sont testés sur des graphes aléatoires et donnent toujours le même coût. L'île n'est reliée par aucun sentier, d'où le message. »

---

### Acte 5 : programmer un départ (45 s)

**Qui** : Hanta. **Fenêtre A.**

1. Menu **Départs**, cliquer **Programmer un départ**.
2. Circuit : **Journée découverte de Mahambo**. Date de début : **dans trois semaines** (la date de fin se propose seule). Nombre de places : `8`. Guide : **Tahina Rasolofo**.
3. Cliquer **Programmer le départ**.

**À dire** : « Le départ est réservable jusqu'à la veille. Il passera tout seul à "Complet" quand toutes les places seront prises (RG 11), et la limite du plan de l'agence est vérifiée (RG 18). »

---

### Acte 6 : le voyageur réserve et paie (2 min 30)

**Qui** : un visiteur, puis Nirina qui se connecte. **Fenêtre B.**

1. Sur le site vitrine de Green Trek Mada, montrer le hero, les cartes de circuits **avec leurs étoiles**, puis la section des avis.
2. Dans la barre de recherche : **Partir à partir du** = la date du départ créé à l'acte 5, **Voyageurs** = 2. Cliquer **Rechercher**.
3. Ouvrir **Journée découverte de Mahambo**. Dans **Prochains départs**, cliquer **Réserver** sur le départ créé.
4. La page affiche **Connectez-vous pour réserver** : se connecter avec `client@green-trek-mada.test`.
5. Tunnel de réservation :
   - **Voyageurs** : Nombre de voyageurs = 2, puis **Continuer** ;
   - **Participants** : le premier est Nirina ; saisir le second (Prénom `Fanja`, Nom `Rabe`), puis **Continuer** ;
   - **Récapitulatif** : vérifier le montant, puis **Confirmer la réservation**.
6. **Paiement** : choisir **Carte bancaire**.
   - Saisir d'abord `4000000000000000` (se termine par 0000) puis **Payer** : le paiement est **refusé** (cas d'échec prévu pour la démo).
   - Saisir ensuite `4242424242424242`, puis **Payer**.

**À l'écran (fenêtre B)** : « Réservation confirmée ! » et la **référence** (ex. `GTM-2026-0212`).

**À l'écran (fenêtre A, sans rien toucher)** : un **son**, une notification « Réservation GTM-… payée », la cloche qui augmente.

**À dire** : « La réservation verrouille la ligne du départ dans une transaction : deux réservations simultanées ne peuvent pas dépasser les places, et c'est testé avec des envois en parallèle (RG 13). Le montant est figé à la création (RG 14). La notification arrive en temps réel, mais seulement après la validation de la transaction. »

---

### Acte 7 : le back-office suit la réservation (1 min)

**Qui** : Hanta. **Fenêtre A.**

1. Cliquer la notification dans la **cloche** : la fiche de la réservation s'ouvre (client, participants, paiement validé).
2. Montrer la **facture** et son **QR code** (scannable avec un téléphone sur le même Wi-Fi).
3. Menu **Journal d'activité** : qui a fait quoi, et quand.

**À dire** : « Le paiement en ligne étant complet, la réservation est confirmée automatiquement. Un virement ou des espèces resteraient "à valider" par l'agence. Les actions sensibles sont tracées dans le journal. »

---

### Acte 8 : la messagerie en temps réel (1 min 30)

**Qui** : Nirina (fenêtre B) et Hanta (fenêtre A), **côte à côte**.

1. **A** : ouvrir le menu **Messages** et le laisser affiché.
2. **B** : menu **Mes réservations**, ouvrir la réservation de l'acte 6, cliquer **Contacter l'agence**. Écrire par exemple : « Bonjour, peut-on prévoir un pique-nique végétarien ? », puis **Envoyer**.
3. **A** : le son retentit, la conversation apparaît en tête de liste, la pastille augmente. Ouvrir la conversation, taper une réponse et appuyer sur **Entrée**.
4. **B** : la réponse apparaît dans le fil **sans recharger la page**.

**À dire** : « Le canal temps réel utilise les Server-Sent Events, un standard du navigateur. L'envoi passe par une action serveur classique, avec les mêmes contrôles que le reste. Chacun ne voit que ses conversations : le voyageur les siennes, le guide celles de ses départs, l'équipe celles de l'agence. Le guide du départ, Tahina, a d'ailleurs reçu ce message aussi. »

**Bonus (30 s), les avis** :
- **B** : dans **Mes réservations**, ouvrir une réservation marquée **Donnez votre avis**, cliquer **Donner mon avis**, choisir 5 étoiles, écrire un commentaire, puis **Envoyer mon avis**.
- **A** : menu **Avis**, cliquer **Publier**. L'avis apparaît sur le site vitrine.
- **À dire** : « RG 17 : un avis seulement après un séjour terminé, un seul par réservation, publié après modération. »

---

### Acte 9 : la preuve de l'isolation des données (1 min)

**Qui** : Andry, administrateur de l'autre agence, Tanety Trek. **Fenêtre C.**

1. **A** : copier l'adresse de la fiche de réservation de l'acte 7 (barre d'adresse, du type `/dashboard/reservations/…`).
2. **C** : se déconnecter de l'Agence Soutenance (bouton **Se déconnecter** en bas du menu), puis se connecter avec `admin@tanety-trek.test`.
3. Montrer que ses réservations, ses départs et ses messages ne contiennent rien de Green Trek Mada.
4. Coller l'adresse copiée : **page introuvable (404)**.

**À dire** : « Toute requête passe par un client de base de données confiné à l'agence, qui ajoute le filtre automatiquement. Une agence ne peut ni lire, ni modifier, ni supprimer les données d'une autre, même avec l'identifiant exact (RG 20). C'est vérifié par des tests automatisés. »

---

### Acte 10 : la console du super admin (1 min)

**Qui** : Fanomezantsoa, super admin. **Fenêtre C.**

1. **Se déconnecter**, puis se connecter avec `superadmin@greentrek-saas.test`.
2. Menu **Agences** : la liste, avec leur plan et leur activité. Ouvrir **Agence Soutenance** (créée à l'acte 1).
3. Cliquer **Attribuer un plan**, choisir **Pro**, puis **Attribuer le plan** : l'essai est clôturé, les nouvelles limites s'appliquent.
4. Cliquer **Suspendre l'agence** et confirmer. Dans la fenêtre B, ouvrir `http://localhost:3000/a/agence-soutenance` : **page introuvable**.
5. Revenir en C et cliquer **Réactiver l'agence**.

**À dire** : « La suspension prend effet immédiatement, sans attendre l'expiration des sessions, car la session est relue en base à chaque requête (RG 19). Aucune donnée n'est supprimée. »

---

## 5. Après la démonstration

```bash
npm run db:seed   # efface l'Agence Soutenance, la réservation et les messages de la démo
```

---

## 6. En cas de problème

| Problème | Solution |
|---|---|
| Pas de son | Cliquer une fois dans la page ; vérifier le bouton haut-parleur de l'en-tête (son coupé ?) et le volume du système. |
| Deux comptes se « mélangent » | Les deux fenêtres partagent la même session : utiliser un autre navigateur (voir la partie 3). |
| La carte reste grise | Pas d'Internet (tuiles OpenStreetMap) : passer aux captures d'écran ou à la vidéo de secours. |
| « Connectez-vous » alors qu'on est connecté | Un voyageur doit se connecter sur le site de son agence (`/a/green-trek-mada/connexion`), pas sur `/connexion`. |
| Le départ créé n'apparaît pas sur le site | Il faut une date d'au moins demain, et le circuit doit être publié ; vérifier la date saisie dans la recherche. |
| Erreur de connexion à la base | MySQL est-il démarré ? `/api/health` doit répondre « connectée ». |

---

## 7. Aide-mémoire (à imprimer)

1. `npm run db:seed`, `npm run build`, `npm start`.
2. A = Chrome normal (`admin@green-trek-mada.test`), B = Chrome privé (vitrine), C = Safari (accueil). Un clic dans chaque fenêtre.
3. **C** : inscription « Agence Soutenance ».
4. **A** : tableau de bord, Carte du réseau, Calcul d'itinéraire (Soanierana Ivongo → Antetezambaro, puis Ambodifototra), Performances, Programmer un départ (dans 3 semaines, 8 places, Tahina).
5. **B** : recherche, Réserver, connexion de Nirina, 2 voyageurs, carte `4000…0000` (refusée), puis `4242…4242` (acceptée).
6. **A** : cloche, fiche, facture, Journal.
7. **A + B** : Messages en direct. Bonus : avis, puis Publier.
8. **C** : Tanety Trek, adresse copiée : 404.
9. **C** : super admin, Attribuer le plan Pro, Suspendre, 404, Réactiver.
10. `npm run db:seed`.
