# Green Trek — application mobile (voyageurs)

Application React Native (Expo SDK 58, Expo Router, TypeScript) pour les voyageurs : circuits de toutes les agences de la plateforme, fiche d'un circuit, réservation et paiement, factures, messagerie avec l'agence et entre voyageurs, itinéraires sur mesure, communauté de photos. Connexion obligatoire après l'écran d'ouverture ; style « verre dépoli », thèmes clair et sombre (onglet Compte → Apparence). Elle lit les données de l'API mobile du site (`/api/mobile/v1`).

## Lancer l'application sur un téléphone

1. Installer **Expo Go** sur le téléphone (App Store ou Google Play).
2. Mettre le téléphone et l'ordinateur sur le **même Wi-Fi**.
3. Démarrer le site, à la racine du projet : `npm run dev` (port 3000).
4. Dans un second terminal : `cd mobile`, puis `npm install` (la première fois), puis `npx expo start`.
5. Scanner le QR code affiché : avec l'appareil photo (iPhone) ou avec Expo Go (Android).

L'application trouve le site toute seule : dans Expo Go, même ordinateur que le serveur Expo, port 3000 ; dans l'APK, **recherche automatique** (voir « Adresse du serveur automatique » ci-dessous). Si elle affiche « Impossible de joindre Green Trek », copier `.env.example` en `.env`, y mettre l'adresse de l'ordinateur sur le Wi-Fi (par exemple `http://192.168.1.20:3000`), puis relancer `npx expo start`.

Aperçu dans un navigateur, sans téléphone : `npx expo start --web`.

## Adresse du serveur automatique (APK)

L'adresse de l'ordinateur change d'un réseau à l'autre. L'application la retrouve **sans réglage** :

- **Quand** : au lancement (l'adresse mémorisée est essayée d'abord), au retour dans l'application, à chaque changement de réseau, et quand le site ne répond plus (recherche puis nouvel essai de la requête). Bandeau « Recherche du serveur Green Trek… » pendant la recherche (quelques secondes).
- **Comment** : le téléphone lit ses adresses IPv4 sur toutes ses interfaces (module natif local `modules/network-addresses`, Android : Wi-Fi **et point d'accès**, que les API ordinaires ne donnent pas ; complété par `expo-network`), puis interroge les adresses voisines du même réseau sur le port 3000 (`/api/mobile/v1/decouverte`, qui répond `{"service":"greentrek"}`), 48 à la fois avec un délai court ; la première qui répond est mémorisée. Seules les adresses privées du réseau local sont parcourues.
- **Cas couverts** : téléphone et ordinateur sur le même Wi-Fi ; **ordinateur connecté au partage de connexion du téléphone** (le téléphone est le point d'accès) ; partage de connexion d'un iPhone (réseau `172.20.10.x`).
- **Secours** : Compte → Adresse du serveur → « Rechercher automatiquement », ou saisie manuelle.
- Le module natif n'existe que dans l'APK (Expo Go ne le contient pas, et n'en a pas besoin). Fonctions pures testées par la suite du site (`tests/unit/mobile-discovery.test.ts`).

## Vérifications

- `npm run typecheck` : TypeScript
- `npm run lint` : ESLint (configuration d'Expo)
- Les fonctions pures (`src/lib/format.ts`, `src/lib/filters.ts`) sont testées par la suite de tests du site (`tests/unit/mobile-format.test.ts`).

## Structure

- `src/app/` : écrans (Expo Router)
  - onglets : `(tabs)/index.tsx` accueil, `(tabs)/explorer.tsx` recherche, `(tabs)/favoris.tsx` favoris (gardés sur le téléphone), `(tabs)/reservations.tsx` mes réservations, `(tabs)/compte.tsx` compte
  - `circuit/[agence]/[slug].tsx` fiche d'un circuit, `reserver/[depart].tsx` réservation, `paiement/[id].tsx` paiement, `reservation/[id].tsx` fiche d'une réservation
  - `messages/` (liste, fil, nouveau message ; conversations avec l'agence et entre voyageurs, présence, blocage, signalement par appui long) et `notifications.tsx`
  - `voyageurs/` : voyageurs de l'agence et premier message à l'un d'eux
  - `communaute/` : fil de photos commun à toutes les agences (accès : bouton en haut de l'accueil et onglet Compte) : mon profil et mes chiffres, recherche, **destinations** (un toucher filtre le fil), onglets **Populaires / Récentes**, publications en **mosaïque** (« +N »), menu « … » (Supprimer ou Signaler), défilement infini ; fiche d'une publication (photos en entier avec leur crédit, commentaires) ; « Partager mes photos » (séjour terminé, jusqu'à 8 photos, galerie ou appareil photo)
  - `itineraires/` : itinéraires sur mesure (proposés par l'agence ou demandés par le voyageur, « Créer mon itinéraire »)
  - `connexion.tsx`, `inscription.tsx`, `mot-de-passe-oublie.tsx` : compte voyageur (propre à une agence) ; `profil.tsx` : photo, profil, confidentialité et mot de passe
- `src/components/` : cartes, bannière, catégories, formulaires, états de chargement, `RequireAuth`, `Avatar` (photo et pastille « en ligne »), `communaute/publication-card.tsx` (mosaïque, menu « … »)
- `src/context/auth.tsx` : session du voyageur (jeton et profil, stockage chiffré du téléphone)
- `src/context/activity.tsx` : nouveautés (toutes les 20 s, application ouverte), pastilles, sonnerie, enregistrement du téléphone pour le push ; `src/lib/notifications.ts` : notifications du téléphone
- `src/lib/` : client de l'API, adresse du site (réglable dans l'onglet Compte), formats français, page de la carte (Leaflet), stockage de la session
- `src/theme/tokens.ts` : palette, thèmes clair et sombre (jetons sémantiques), polices du site ; `src/theme/theme.tsx` : thème courant et `makeStyles` ; `src/components/glass.tsx` : verre dépoli, boutons ronds, sélecteur à segments
- `src/app/serveur.tsx` : adresse du serveur (accessible avant la connexion), avec « Rechercher automatiquement »
- `src/lib/discovery.ts` et `discovery-core.ts` : recherche automatique du site sur le réseau local ; `src/components/server-watcher.tsx` : vérification au retour et au changement de réseau, bandeau de recherche ; `modules/network-addresses/` : module natif Android (adresses de toutes les interfaces)

## Tester une réservation

Compte de démonstration : `client@green-trek-mada.test`, mot de passe `Demo2026!`, agence **Green Trek Mada**. Une carte dont le numéro se termine par `0000` est refusée ; `4242 4242 4242 4242` est acceptée. Relancer `npm run db:seed` à la racine pour retrouver la base d'origine.

## Tester la communauté et les voyageurs

- **Communauté** : 60 publications de départ (voyageurs des trois agences, photos libres de Wikimedia Commons créditées) sont créées par `npm run db:seed`, ou ajoutées sans rien effacer par `npm run db:seed:communaute` (à la racine). Avec Nirina (`client@green-trek-mada.test`), qui a des séjours terminés, « Partager mes photos » est disponible.
- **Voyageurs entre eux** : onglet Compte → Voyageurs ; un autre voyageur de Green Trek Mada pour répondre : `andry.rakotondrabe@example.com` (même mot de passe).
- **Facture** : « Voir la facture » ouvre la facture du site dans le navigateur du téléphone (même Wi-Fi que l'ordinateur, ou `npm run tunnel` à la racine pour la 4G).

## Notifications qui sonnent

- **Dans Expo Go** (niveau 1) : application ouverte, chaque nouveauté (message de l'agence, confirmation, paiement, annulation) fait sonner le téléphone dans les 20 secondes. Accepter la demande d'autorisation à la connexion.
- **Avec l'APK** (niveau 2) : le téléphone sonne même application fermée (service push d'Expo). Configuration à faire une fois, avant la fabrication (étapes 2 bis ci-dessous).

## Fabriquer l'APK Android (lien de téléchargement pour la démonstration)

> **À refaire après chaque évolution de l'application** : un APK contient les écrans du jour de sa fabrication. Celui du 2026-11-11 ne contient pas les itinéraires sur mesure, les photos de profil, les voyageurs entre eux ni la communauté. Commande : `npx eas-cli@latest build -p android --profile apk` (étape 3), puis remplacer le fichier sur Google Drive (le lien de partage peut rester le même avec « Gérer les versions »).

L'application n'est pas publiée sur les stores (hors périmètre, cahier des charges §2). Pour la démonstration, on fabrique un fichier **APK** installable sur Android, et on le partage par un lien (Google Drive). Sur iPhone, l'installation hors App Store n'est pas possible : utiliser Expo Go.

1. Créer un compte gratuit sur [expo.dev](https://expo.dev), puis, dans `mobile/` : `npx eas-cli@latest login`.
2. L'adresse du site se règle dans l'application (roue dentée de l'écran de connexion, étape 6) : rien à mettre dans `eas.json`.
2 bis. **Notifications push** (pour que le téléphone sonne application fermée) :
   - `npx eas-cli@latest init` : crée le projet sur expo.dev et ajoute son identifiant (`extra.eas.projectId`) à `app.json` ;
   - créer un projet gratuit sur [console.firebase.google.com](https://console.firebase.google.com), y ajouter une application Android de nom de paquet `mg.greentrek.voyageurs`, télécharger `google-services.json` dans `mobile/` (ignoré par git ; `app.config.js` le prend en compte), puis le confier à EAS : `npx eas-cli@latest env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment preview --visibility secret` ;
   - dans Firebase, « Paramètres du projet » → « Comptes de service » → « Générer une nouvelle clé privée », puis `npx eas-cli@latest credentials` → Android → « Google Service Account » → « FCM V1 » : y déposer ce fichier. **Ne jamais committer cette clé privée.**
3. `npx eas-cli@latest build -p android --profile apk` : la fabrication se fait sur les serveurs d'Expo (une dizaine de minutes) ; un lien de téléchargement du fichier `.apk` s'affiche à la fin.
4. Déposer le fichier `.apk` sur Google Drive, puis « Partager » → « Tous les utilisateurs disposant du lien ».
5. Dans le `.env` du site : `MOBILE_APP_URL="<lien de partage Drive>"`, puis redémarrer le site. L'encart « Téléchargez l'application » apparaît sur l'accueil de la plateforme et des sites vitrines, avec un QR code.
6. Sur le téléphone : installer l'APK (autoriser l'installation depuis cette source). L'application trouve le site toute seule (même Wi-Fi, ou ordinateur connecté au partage de connexion du téléphone). En dernier recours : **roue dentée** de l'écran de connexion (« Adresse du serveur »), « Rechercher automatiquement » ou saisie de l'adresse (affichée par `ipconfig getifaddr en0` sur macOS).

Réglages déjà prévus pour l'APK (`app.json`) : identifiant `mg.greentrek.voyageurs`, et connexions `http://` autorisées (`expo-build-properties`, `usesCleartextTraffic`), car le site de démonstration tourne sans HTTPS sur le réseau local. Pour une vraie mise en production : site en HTTPS et ce réglage retiré.
