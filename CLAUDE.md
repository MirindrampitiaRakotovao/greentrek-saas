# Green Trek SaaS — instructions pour Claude Code

## Contexte

Plateforme SaaS multi-agences de gestion et de réservation de circuits de randonnée pour agences de voyage, avec un module d'optimisation d'itinéraires (algorithmes de plus court chemin). Projet de fin d'études (Master 2, ENI Fianarantsoa) réalisé en stage chez Green Trek Mada, première agence cliente. Démo locale pour la soutenance, pas de mise en ligne publique.

- Cahier des charges complet : @docs/CAHIER_DES_CHARGES.md
- Maquette d'inspiration de la landing page : docs/design/landing-mockup.jpeg (référence visuelle uniquement)
- Suivi d'avancement (à tenir à jour) : docs/AVANCEMENT.md

## Règles de collaboration

1. Réponds en français.
2. Une étape à la fois (plan au §10 du cahier des charges). Avant de coder une étape : résume en quelques lignes ce que tu vas faire et pourquoi, puis attends mon accord.
3. Explique avant de coder : courte explication du pourquoi et du comment. Je dois pouvoir défendre chaque choix à l'oral devant un jury.
4. Après chaque étape : lance typecheck, lint, tests et build, donne le résultat, et ne passe à l'étape suivante qu'après ma confirmation que tout fonctionne chez moi.
5. Quand tu me montres du code à copier, donne le fichier complet (pas de diff partiel). Sinon, modifie les fichiers directement et résume les changements.
6. Ne rien inventer : aucune fausse donnée présentée comme réelle (coordonnées GPS, prix, noms de villages). Marque `TODO(données terrain)`.
7. Tiens `docs/AVANCEMENT.md` à jour : fait / en cours / décisions et justifications / captures d'écran à prendre. Ne marque jamais « fait » ce qui n'est pas testé. Ce fichier alimente mon mémoire.
8. Signale tout écart avec le cahier des charges avant de l'implémenter.

## Stack (résumé)

Next.js (App Router) + TypeScript strict · MySQL + Prisma · Auth.js (credentials, rôles) · Tailwind CSS · Zod · React Hook Form · Leaflet / react-leaflet + OpenStreetMap · Recharts · Vitest. Vérifie la documentation de la version installée avant d'utiliser une API (elles évoluent).

## Conventions

- Modèles et champs métier en français sans accents (`Circuit`, `Etape`, `Troncon`, `nombrePersonnes`…), comme dans le mémoire. Identifiants techniques (fonctions, composants, hooks) en anglais.
- TypeScript strict, pas de `any`. Validation Zod à chaque frontière (formulaires, route handlers, server actions).
- Multi-tenant : toute requête sur une table liée à une agence passe par le helper tenant (cahier des charges §4). Jamais de requête Prisma sans filtre `agenceId` sur ces tables. Tests d'isolation obligatoires.
  - Implémentation : `getTenantDb(agenceId)` dans `src/lib/tenant.ts`, configuration dans `src/lib/tenant-config.ts` (à mettre à jour pour toute nouvelle table ou clé étrangère). Importer `@/lib/db` dans `src/` est une erreur ESLint ; super admin et authentification passent par `getAdminDb()`.
  - À la création, passer `agenceId` explicitement (le helper vérifie qu'il correspond). Pas d'écriture imbriquée (`connect`, `create` dans `data`) : utiliser les clés étrangères.
- Pas de secrets dans le code : `.env` (ignoré par git) + `.env.example`.
- Algorithmes dans `src/lib/graph/` : fonctions pures (sans UI ni base de données), testées unitairement.
- Palette et typographie : cahier des charges §8, tokens CSS dans `src/styles/tokens.css`.
- Commits petits, messages en français à l'impératif.

## Versions et documentation
Next.js 16.3 (App Router, Turbopack ; `proxy.ts` remplace `middleware.ts`) · Prisma 7.10 (fixée ; `prisma.config.ts`, adaptateur `@prisma/adapter-mariadb`, client généré dans `src/generated/prisma`) · Tailwind CSS 4 (configuration dans le CSS via `@theme`) · Vitest 5 · Node ≥ 24.
Documentation Next.js de la version installée : voir @AGENTS.md.

## Commandes
- Installation initiale : `cp .env.example .env`, puis `mysql -u root -p < scripts/init-db.sql` (une seule fois), puis `npm install`
- `npm run dev` : serveur de développement (http://localhost:3000, santé : `/api/health`)
- `npm run build` / `npm start` : build et serveur de production
- `npm run typecheck` : `next typegen` + `tsc --noEmit`
- `npm run lint` : ESLint · `npm run format` / `npm run format:check` : Prettier (hors `docs/` et `*.md`)
- `npm test` : Vitest, projets `unit` et `integration` (ce dernier applique les migrations à `greentrek_test` avec `migrate deploy` et vide les tables avant chaque test ; si une migration existante a été modifiée : `DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate reset`, à lancer par l'étudiant) · `npx vitest run --project unit` · `npm run test:watch`
- `npm run db:migrate` : `prisma migrate dev` puis `prisma generate` (Prisma 7 ne régénère plus le client automatiquement) · `npm run db:seed` (vide puis remplit la base de dev) · `npm run db:studio`
- Contraintes CHECK : Prisma ne les gère pas. Pour une nouvelle contrainte, `prisma migrate dev --create-only`, puis ajouter le SQL à la main dans la migration
