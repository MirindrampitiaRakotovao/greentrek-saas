# Green Trek — application mobile (voyageurs)

Application React Native (Expo SDK 58, Expo Router, TypeScript) pour les voyageurs : circuits de toutes les agences de la plateforme, fiche d'un circuit, réservation. Connexion obligatoire après l'écran d'ouverture ; style « verre dépoli », thèmes clair et sombre (onglet Compte → Apparence). Elle lit les données de l'API mobile du site (`/api/mobile/v1`).

## Lancer l'application sur un téléphone

1. Installer **Expo Go** sur le téléphone (App Store ou Google Play).
2. Mettre le téléphone et l'ordinateur sur le **même Wi-Fi**.
3. Démarrer le site, à la racine du projet : `npm run dev` (port 3000).
4. Dans un second terminal : `cd mobile`, puis `npm install` (la première fois), puis `npx expo start`.
5. Scanner le QR code affiché : avec l'appareil photo (iPhone) ou avec Expo Go (Android).

L'application trouve le site toute seule : même ordinateur que le serveur Expo, port 3000. Si elle affiche « Impossible de joindre Green Trek », copier `.env.example` en `.env`, y mettre l'adresse de l'ordinateur sur le Wi-Fi (par exemple `http://192.168.1.20:3000`), puis relancer `npx expo start`.

Aperçu dans un navigateur, sans téléphone : `npx expo start --web`.

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
  - `communaute/` : fil de photos commun à toutes les agences, fiche d'une publication avec ses commentaires, « Partager mes photos » (séjour terminé)
  - `itineraires/` : itinéraires sur mesure (proposés par l'agence ou demandés par le voyageur, « Créer mon itinéraire »)
  - `connexion.tsx`, `inscription.tsx`, `mot-de-passe-oublie.tsx` : compte voyageur (propre à une agence) ; `profil.tsx` : photo, profil, confidentialité et mot de passe
- `src/components/` : cartes, bannière, catégories, formulaires, états de chargement, `RequireAuth`
- `src/context/auth.tsx` : session du voyageur (jeton et profil, stockage chiffré du téléphone)
- `src/context/activity.tsx` : nouveautés (toutes les 20 s, application ouverte), pastilles, sonnerie, enregistrement du téléphone pour le push ; `src/lib/notifications.ts` : notifications du téléphone
- `src/lib/` : client de l'API, adresse du site (réglable dans l'onglet Compte), formats français, page de la carte (Leaflet), stockage de la session
- `src/theme/tokens.ts` : palette, thèmes clair et sombre (jetons sémantiques), polices du site ; `src/theme/theme.tsx` : thème courant et `makeStyles` ; `src/components/glass.tsx` : verre dépoli, boutons ronds, sélecteur à segments
- `src/app/serveur.tsx` : adresse du serveur (accessible avant la connexion)

## Tester une réservation

Compte de démonstration : `client@green-trek-mada.test`, mot de passe `Demo2026!`, agence **Green Trek Mada**. Une carte dont le numéro se termine par `0000` est refusée ; `4242 4242 4242 4242` est acceptée. Relancer `npm run db:seed` à la racine pour retrouver la base d'origine.

## Notifications qui sonnent

- **Dans Expo Go** (niveau 1) : application ouverte, chaque nouveauté (message de l'agence, confirmation, paiement, annulation) fait sonner le téléphone dans les 20 secondes. Accepter la demande d'autorisation à la connexion.
- **Avec l'APK** (niveau 2) : le téléphone sonne même application fermée (service push d'Expo). Configuration à faire une fois, avant la fabrication (étapes 2 bis ci-dessous).

## Fabriquer l'APK Android (lien de téléchargement pour la démonstration)

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
6. Sur le téléphone : installer l'APK (autoriser l'installation depuis cette source), puis, sur l'écran de connexion, la **roue dentée** (« Adresse du serveur ») : saisir l'adresse de l'ordinateur sur le Wi-Fi du jour (affichée par `ipconfig getifaddr en0` sur macOS), puis « Tester et enregistrer ».

Réglages déjà prévus pour l'APK (`app.json`) : identifiant `mg.greentrek.voyageurs`, et connexions `http://` autorisées (`expo-build-properties`, `usesCleartextTraffic`), car le site de démonstration tourne sans HTTPS sur le réseau local. Pour une vraie mise en production : site en HTTPS et ce réglage retiré.
