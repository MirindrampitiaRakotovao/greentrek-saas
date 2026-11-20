# Green Trek SaaS

Plateforme SaaS multi-agences de gestion et de réservation de circuits de randonnée, avec optimisation d'itinéraires (Dijkstra, A\*). Projet de fin d'études, Master 2, ENI Fianarantsoa. Cas d'étude et première agence utilisatrice : **Green Trek Mada** (Mahambo).

Ce document est le **guide pas à pas de la démonstration** : qui se connecte, dans quelle fenêtre, où cliquer, ce qui doit apparaître à l'écran et ce qu'il faut dire au jury. Durée visée : **12 minutes environ**.

> Documents liés : cahier des charges `docs/CAHIER_DES_CHARGES.md`, suivi `docs/AVANCEMENT.md`, version courte du déroulé `docs/SCRIPT_DEMO.md`, application mobile `mobile/README.md`.

**Ce que contient la plateforme**

- **Plateforme SaaS** : accueil, tarifs, inscription d'une agence avec essai de 30 jours, console du super admin (agences, plans, journal, boîte d'envoi, modération de la communauté).
- **Back-office de chaque agence** : tableau de bord, circuits, carte du réseau (étapes et tronçons), calcul d'itinéraire (Dijkstra et A\*, visibles en **mode expert**), départs, réservations, paiements, clients (y compris ajoutés par l'agence), itinéraires sur mesure, avis, signalements, équipe, guides, partenaires, paramètres et logo, messagerie en temps réel.
- **Site vitrine et espace voyageur** : recherche, fiche d'un circuit avec la note, réservation et paiement, factures avec QR code lisible hors ligne, itinéraires sur mesure, messagerie avec l'agence et entre voyageurs (présence « en ligne »), communauté de photos commune à toutes les agences, photo de profil.
- **Application mobile des voyageurs** (Expo, Android et iOS) : les mêmes fonctions côté voyageur, notifications sur le téléphone.
- **Isolation des données** : chaque agence ne voit que ses données (client de base de données confiné, testé).

---

## 1. Lancer la plateforme

**Une seule fois (installation)** : `cp .env.example .env`, puis `mysql -u root -p < scripts/init-db.sql`, puis `npm install` et `npm run db:migrate`.

Réglages facultatifs dans `.env` (détails dans `.env.example`) :

- `SMTP_USER`, `SMTP_PASSWORD` (mot de passe d'application Gmail), `MAIL_FROM` : envoi réel des e-mails (mot de passe oublié, invitation d'un client ajouté par l'agence). Laissés vides, les e-mails restent dans la **Boîte d'envoi** de la console du super admin. Ne jamais mettre ces valeurs dans git.
- `UPLOAD_DIR` : dossier des images envoyées (photos de profil, logos, photos de la communauté), `uploads/` par défaut, ignoré par git.
- `MOBILE_APP_URL` : lien de téléchargement de l'APK, affiché sur le site.

**Avant chaque répétition et le jour J** :

```bash
npm run db:seed     # remet la base de démonstration à zéro (3 agences, ~500 réservations, avis, messages)
                    # les images déjà envoyées restent dans uploads/ (sans effet sur la démo)
npm run build       # version de production : plus rapide et plus stable que le mode développement
npm start           # http://localhost:3000
```

Vérifier que <http://localhost:3000/api/health> répond `"database": "connectée"`.

**Application mobile** (facultatif) : installer l'APK sur un téléphone Android, ou lancer `cd mobile && npx expo start` (voir `mobile/README.md`). Le téléphone doit être sur le **même Wi-Fi** que l'ordinateur ; l'adresse du serveur se règle dans l'application (Compte, puis Adresse du serveur).

---

## 2. Les personnages de la démo

Mot de passe de **tous** les comptes : `Demo2026!`

| Personnage | Rôle dans la plateforme | Compte | Page de connexion |
|---|---|---|---|
| Hanta Razafimahefa | Administratrice de Green Trek Mada | `admin@green-trek-mada.test` | `/connexion` |
| Mamy Andrianarisoa | Personnel de Green Trek Mada | `staff@green-trek-mada.test` | `/connexion` |
| Tahina Rasolofo | Guide de Green Trek Mada | `guide@green-trek-mada.test` | `/connexion` |
| Nirina Randriamanana | Voyageuse, cliente de Green Trek Mada | `client@green-trek-mada.test` | `/a/green-trek-mada/connexion` |
| Andry Rakotondrabe | Autre voyageur de Green Trek Mada (actes bonus) | `andry.rakotondrabe@example.com` | `/a/green-trek-mada/connexion` |
| Andry Rakotoarivelo | Administrateur de **Tanety Trek** (autre agence) | `admin@tanety-trek.test` | `/connexion` |
| Camille Lefebvre | Voyageuse, cliente de **Tanety Trek** (actes bonus) | `client@tanety-trek.test` | `/a/tanety-trek/connexion` |
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

1. Menu **Calcul d'itinéraire**. Par défaut, la page parle comme un voyageur : départ, arrivée, critère, bouton **Calculer le meilleur itinéraire**, sans terme technique.
2. Activer l'interrupteur **Mode expert** (en haut de la page) : le choix **Algorithme** et le menu **Performances** apparaissent. Le réglage est mémorisé.
3. Départ : **Soanierana Ivongo**. Arrivée : **Antetezambaro** (tout le réseau, du nord au sud).
4. Critère : **Plus court**. Algorithme : **Comparer**. Cliquer **Comparer Dijkstra et A\***.

**À l'écran** : le tracé sur la carte, puis le tableau de comparaison. Le **coût est identique**, mais A\* explore **moins de nœuds**, ce qu'on voit aussi sur la carte.

5. Changer l'arrivée pour **Ambodifototra** (île Sainte-Marie) et relancer : message « Aucun chemin entre … : ces étapes ne sont reliées par aucune suite de tronçons. »
6. Menu **Performances** (visible en mode expert) : cliquer **Lancer le banc d'essai** et montrer les graphiques (temps et nœuds explorés selon la taille du graphe).

**À dire** : « Pour l'agence et les voyageurs, les noms des algorithmes sont cachés : ils choisissent un critère, pas un algorithme. Le mode expert sert à la mesure. A\* reste exact parce que son heuristique, la distance à vol d'oiseau, ne surestime jamais le coût restant : elle est admissible. Les deux algorithmes sont testés sur des graphes aléatoires et donnent toujours le même coût. L'île n'est reliée par aucun sentier, d'où le message. »

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
2. Montrer la **facture** et son **QR code** : le scanner avec un téléphone, **même sans réseau**, affiche le numéro de facture, l'agence, la réservation, le circuit, les dates et les montants. Le lien vers la facture en ligne, en dernière ligne, ne s'ouvre que sur le même Wi-Fi.
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
- **B** : ouvrir la fiche d'un circuit que Nirina a déjà fait (dans **Mes réservations**, une réservation terminée marquée **Donnez votre avis**, puis son circuit). Le bloc **Votre note** est en tête de la fiche : choisir 5 étoiles, écrire un commentaire, puis envoyer. (On peut aussi noter depuis la réservation, avec **Donner mon avis**.)
- **A** : menu **Avis**, cliquer **Publier**. L'avis apparaît sur le site vitrine.
- **À dire** : « RG 17 : un avis seulement après un séjour terminé, un seul par réservation, publié après modération. »

---

### Acte 9 : la preuve de l'isolation des données (1 min)

**Qui** : Andry, administrateur de l'autre agence, Tanety Trek. **Fenêtre C.**

1. **A** : copier l'adresse de la fiche de réservation de l'acte 7 (barre d'adresse, du type `/dashboard/reservations/…`).
2. **C** : se déconnecter de l'Agence Soutenance (bouton **Se déconnecter** en bas du menu), puis se connecter avec `admin@tanety-trek.test`.
3. Montrer que ses réservations, ses départs et ses messages ne contiennent rien de Green Trek Mada.
4. Coller l'adresse copiée : **page introuvable (404)**.

**À dire** : « Toute requête passe par un client de base de données confiné à l'agence, qui ajoute le filtre automatiquement. Une agence ne peut ni lire, ni modifier, ni supprimer les données d'une autre, même avec l'identifiant exact (RG 20). C'est vérifié par des tests automatisés. La communauté de photos, commune à toutes les agences, n'est pas une exception : ce sont des tables de la plateforme, auxquelles aucune agence n'a accès, modérées par le super admin. »

---

### Acte 10 : la console du super admin (1 min)

**Qui** : Fanomezantsoa, super admin. **Fenêtre C.**

1. **Se déconnecter**, puis se connecter avec `superadmin@greentrek-saas.test`.
2. Menu **Agences** : la liste, avec leur plan et leur activité. Ouvrir **Agence Soutenance** (créée à l'acte 1).
3. Cliquer **Attribuer un plan**, choisir **Pro**, puis **Attribuer le plan** : l'essai est clôturé, les nouvelles limites s'appliquent.
4. Cliquer **Suspendre l'agence** et confirmer. Dans la fenêtre B, ouvrir `http://localhost:3000/a/agence-soutenance` : **page introuvable**.
5. Revenir en C et cliquer **Réactiver l'agence**.

6. Menu **Communauté** : les publications et commentaires signalés par les voyageurs, avec **Masquer**, **Classer sans suite** et **Rétablir** (voir l'acte bonus 5).

**À dire** : « La suspension prend effet immédiatement, sans attendre l'expiration des sessions, car la session est relue en base à chaque requête (RG 19). Aucune donnée n'est supprimée. »

---

## 4 bis. Actes bonus (si le temps le permet, ou pour répondre au jury)

Ces fonctions ont été ajoutées après le cahier des charges, à la demande de l'étudiant. Chacune se montre en une à deux minutes.

### Bonus 1 : l'agence ajoute un client et réserve pour lui

**Fenêtre A** (Hanta). Menu **Clients**, **Ajouter un client** : prénom, nom, e-mail (en `@example.com`). Sur sa fiche, **Réserver pour ce client** l'inscrit sur un départ ouvert. Le client reçoit un e-mail d'invitation pour choisir son mot de passe (valable 7 jours). Sans configuration Gmail, le message l'indique et l'e-mail est visible dans la **Boîte d'envoi** du super admin.

### Bonus 2 : les itinéraires sur mesure

- **L'agence propose** (fenêtre A) : **Clients**, ouvrir Nirina, **Composer un itinéraire** ; choisir le départ, l'arrivée, les étapes et le critère, calculer, puis **Proposer cet itinéraire à Nirina** et **Envoyer à Nirina**. Fenêtre B : **Mes itinéraires**, ouvrir la proposition, **Accepter cet itinéraire**.
- **Le voyageur demande** (fenêtre B) : **Mes itinéraires**, **Créer mon itinéraire**, choisir les villages, calculer, puis **Envoyer à l'agence**. Fenêtre A : menu **Itinéraires sur mesure** (pastille « en attente »), ouvrir la demande, **Accepter la demande** (avec une réponse facultative).
- **À dire** : « Le même moteur de calcul sert à l'agence et au voyageur ; le voyageur ne voit jamais les noms des algorithmes. »

### Bonus 3 : photos de profil et logo

Fenêtre B : **Mon profil**, **Photo de profil**. Fenêtre A : **Paramètres**, logo de l'agence. L'image est vérifiée, réduite, convertie en WebP, et ses métadonnées (dont la position GPS) sont retirées. Les messages de l'équipe s'affichent avec le logo de l'agence.

### Bonus 4 : les voyageurs se parlent, présence « en ligne »

1. Fenêtre B (Nirina) : menu **Voyageurs** (les voyageurs de la même agence, avec « en ligne » ou « vu il y a … »), **Écrire** à Andry R.
2. Fenêtre C : se connecter comme Andry (`andry.rakotondrabe@example.com`) sur `/a/green-trek-mada/connexion`, ouvrir **Messages** et répondre. Chez Nirina, le message passe à « Lu ».
3. Fenêtre B : **Signaler** le message reçu. Fenêtre A : menu **Signalements** (pastille « à traiter ») : l'agence voit **ce message seulement**, le marque traité ; l'administrateur peut désactiver le compte de l'auteur.
4. Montrer **Bloquer** en tête de la conversation et, dans **Mon profil**, **Confidentialité** : « Montrer quand je suis en ligne », « Recevoir des messages des autres voyageurs ».
- **À dire** : « La conversation entre voyageurs est privée : l'équipe et le guide ne la voient pas, ni dans la liste, ni dans le temps réel. On ne montre que le prénom, l'initiale et la photo, jamais l'e-mail. »

### Bonus 5 : la communauté de toutes les agences

1. Fenêtre B (Nirina) : menu **Communauté**, **Partager mes photos** : choisir un séjour terminé, 1 à 4 photos, une légende, **Publier**.
2. Fenêtre C : se connecter comme Camille (`client@tanety-trek.test`) sur `/a/tanety-trek/connexion`, menu **Communauté** : la publication de Nirina, voyageuse d'une **autre agence**, est là. **J'aime**, commenter, puis **Signaler**.
3. Fenêtre C : se déconnecter, se connecter en super admin, menu **Communauté** : **Masquer**. La publication disparaît du fil de toutes les agences.
- **À dire** : « On ne publie qu'après un séjour terminé, comme pour les avis. Le fil est commun à la plateforme, donc modéré par la plateforme et non par une agence. »

### Bonus 6 : l'application mobile

Sur le téléphone (même Wi-Fi), se connecter avec `client@green-trek-mada.test` : accueil et recherche, fiche d'un circuit avec la carte et la note, réservation et paiement, **Voyages** (factures), **Messages** et **Voyageurs**, **Communauté** (bouton en haut de l'accueil), **Mes itinéraires**. Une réponse de l'agence (fenêtre A) fait **sonner le téléphone**.

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
| L'e-mail d'invitation ou de mot de passe n'arrive pas | `SMTP_USER` / `SMTP_PASSWORD` vides ou faux dans `.env` : l'e-mail est dans la **Boîte d'envoi** du super admin. |
| « Calcul d'itinéraire » sans choix d'algorithme, pas de menu Performances | Activer **Mode expert** en haut de la page Calcul d'itinéraire. |
| Une photo est refusée | 5 Mo au plus, format JPEG, PNG ou WebP. |
| « Partager mes photos » n'apparaît pas | Il faut un séjour **terminé** : se connecter avec Nirina (`client@green-trek-mada.test`), qui en a. |
| L'application affiche « Impossible de joindre Green Trek » | Téléphone sur le même Wi-Fi que l'ordinateur ; corriger l'adresse dans Compte, puis Adresse du serveur (par exemple `http://192.168.1.20:3000`). |

---

## 7. Aide-mémoire (à imprimer)

1. `npm run db:seed`, `npm run build`, `npm start`.
2. A = Chrome normal (`admin@green-trek-mada.test`), B = Chrome privé (vitrine), C = Safari (accueil). Un clic dans chaque fenêtre.
3. **C** : inscription « Agence Soutenance ».
4. **A** : tableau de bord, Carte du réseau, Calcul d'itinéraire (**Mode expert**, Soanierana Ivongo → Antetezambaro, puis Ambodifototra), Performances, Programmer un départ (dans 3 semaines, 8 places, Tahina).
5. **B** : recherche, Réserver, connexion de Nirina, 2 voyageurs, carte `4000…0000` (refusée), puis `4242…4242` (acceptée).
6. **A** : cloche, fiche, facture (QR scanné hors ligne), Journal.
7. **A + B** : Messages en direct. Bonus : avis, puis Publier.
8. **C** : Tanety Trek, adresse copiée : 404.
9. **C** : super admin, Attribuer le plan Pro, Suspendre, 404, Réactiver.
10. Bonus selon le temps : client ajouté, itinéraire sur mesure, voyageurs entre eux, communauté, application mobile.
11. `npm run db:seed`.
