# Green Trek — application mobile (voyageurs)

Application React Native (Expo SDK 58, Expo Router, TypeScript) pour les voyageurs : circuits de toutes les agences de la plateforme, fiche d'un circuit, réservation. Elle lit les données de l'API mobile du site (`/api/mobile/v1`).

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

- `src/app/` : écrans (Expo Router) — `(tabs)/index.tsx` accueil, `(tabs)/explorer.tsx` recherche, `circuit/[agence]/[slug].tsx` fiche d'un circuit
- `src/components/` : cartes, bannière, catégories, états de chargement
- `src/lib/` : client de l'API, adresse du site, formats français
- `src/theme/tokens.ts` : palette et polices du site (Nohemi, Poppins, Dancing Script)
