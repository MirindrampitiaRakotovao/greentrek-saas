# Suivi d'avancement

Fichier tenu à jour par Claude Code à chaque étape. Il alimente le mémoire : ne jamais marquer « fait » ce qui n'est pas testé.

## État des étapes

| Étape | Statut | Date | Remarques |
|---|---|---|---|
| E0 Initialisation | Fait | 2026-09-28 | Typecheck, lint, test et build verts ; base MySQL créée ; `/api/health` renvoie 200 « connectée » (vérifié chez l'étudiant) |
| E1 Schéma Prisma | Fait | 2026-09-28 | 19 tables et 18 CHECK migrés, seed OK, ERD rédigé ; typecheck, lint et build verts ; `npm test` 23/23 (3 unitaires, 20 d'intégration) chez l'étudiant |
| E2 Auth et multi-tenant | À faire | | |
| E3 Fondations back-office | À faire | | |
| E4 Circuits et étapes | À faire | | |
| E5 Éditeur de graphe | À faire | | |
| E6 Algorithmes | À faire | | |
| E7 Départs | À faire | | |
| E8 Site vitrine | À faire | | |
| E9 Réservation client | À faire | | |
| E10 Back-office opérationnel | À faire | | |
| E11 Super admin, plans | À faire | | |
| E12 Finition | À faire | | |

## Décisions et justifications

### E0 — Initialisation (2026-09-28)

- **Next.js 16.3.6** (dernière version stable), App Router, dossier `src/`, Turbopack. Nouveautés à connaître : `proxy.ts` remplace `middleware.ts` ; `next lint` n'existe plus (ESLint est lancé directement).
- **npm** comme gestionnaire de paquets : fourni avec Node 24, pnpm n'est pas installé. `@types/node` est aligné sur Node 24 (exigé par Vitest 5).
- **MySQL 8.0.41 en local, sans Docker** (Docker n'est pas installé). Un utilisateur dédié `greentrek` (moindre privilège : l'application ne se connecte jamais en root) et une base `greentrek_shadow`, exigée par `prisma migrate dev` pour détecter les dérives de schéma (`scripts/init-db.sql`). Encodage `utf8mb4` pour les accents.
- **Prisma 7.10.0, version fixée** : sur npm, le tag `latest` pointe vers une version de test (8.0.0-rc.17), on retient donc la dernière version stable. Prisma 7 impose un *driver adapter* (`@prisma/adapter-mariadb`, pilote `mariadb` compatible MySQL) et un fichier `prisma.config.ts`. Le client est généré dans `src/generated/prisma` (non versionné, régénéré par `postinstall`).
- **Client Prisma unique** (`src/lib/db.ts`), conservé sur `globalThis` en développement pour ne pas ouvrir un pool de connexions à chaque rechargement à chaud. `allowPublicKeyRetrieval` est activé, car MySQL 8 authentifie par `caching_sha2_password` et il n'y a pas de TLS en local : acceptable pour la démo, à remplacer par TLS en production.
- **Audit npm** : alertes sur les pilotes `mariadb` et `mysql2` (fuite du mot de passe par une attaque de l'homme du milieu malgré TLS, jeux de caractères asiatiques). Aucun correctif compatible avec Prisma 7 ; risque non applicable à une démo locale en `utf8mb4`. À citer dans les limites du mémoire.
- **TypeScript strict + `noUncheckedIndexedAccess`** : un accès `tableau[i]` est typé `T | undefined`, ce qui oblige à traiter les index hors limites (utile pour les files de priorité et les chemins du graphe).
- **ESLint** (configuration Next.js core-web-vitals + TypeScript, `no-explicit-any` en erreur) et **Prettier** (avec tri des classes Tailwind) ; `eslint-config-prettier` évite les conflits entre les deux. Les documents `docs/` et `*.md` sont exclus de Prettier.
- **Tailwind CSS 4** : les tokens de `src/styles/tokens.css` (cahier des charges §8.2) sont exposés à Tailwind via `@theme` (`bg-gt-teal-700`, `text-gt-cream`…) et ne sont définis qu'une seule fois.
- **Polices Poppins et Kaushan Script via `next/font`** : téléchargées au build et servies par l'application, donc disponibles hors ligne pendant la démo.
- **Vitest 5** en environnement Node (les tests portent sur la logique : graphes, isolation tenant). Un test de fumée vérifie la présence des tokens.
- **Route `GET /api/health`** : exécute `SELECT 1` et renvoie 200 ou 503, sans exposer le détail de l'erreur (journalisé côté serveur). Elle prouve le critère « la connexion MySQL fonctionne ».

### Points validés, à traiter plus tard

- Connexion : clients sur `/a/[slug]/connexion`, personnel sur `/connexion` (écart de routage validé ; mise en œuvre en E1/E2).
- Tronçons bidirectionnels en double, contraintes `CHECK` SQL, montants en `Int` (Ariary) : à trancher en E1.

### E1 — Schéma Prisma (2026-09-28)

- **19 tables** conformes au §5.2 (`prisma/schema.prisma`), 14 énumérations. ERD et écarts détaillés dans `docs/ERD.md`.
- **Identifiants `cuid()`** (texte) : non devinables dans les URL, ce qui évite l'énumération (`/reserver/[sessionId]`). C'est une défense en profondeur ; l'isolation reste assurée par le helper tenant (E2). Les réservations ont en plus une `reference` lisible.
- **Montants en `Int`** (Ariary, sans centimes en usage) : pas d'erreur d'arrondi. **Distances et coordonnées en `Float`** (double précision) : directement exploitables par les algorithmes.
- **Index** sur chaque `agenceId` (souvent composés avec le champ filtré le plus fréquent : `(agenceId, statut)`, `(agenceId, dateDebut)`) et sur chaque clé étrangère (§12).
- **Actions référentielles** : `RESTRICT` par défaut (on suspend une agence, on ne la supprime pas) ; `CASCADE` pour les liaisons qui n'ont pas de sens sans leur parent (`CircuitEtape`, `CircuitPartenaire`, `Participant`, `Notification`) ; `SET NULL` pour les références facultatives (guide d'un départ, historique d'itinéraires). RG 8 est donc garantie par la base.
- **18 contraintes CHECK** ajoutées à la main dans la migration `init` (Prisma ne sait pas les déclarer) : double défense avec Zod. Vérifié : Prisma ignore ces CHECK dans sa détection de dérive (une migration générée ensuite est vide), elles ne seront donc pas supprimées par erreur. Les relations `Troncon → Etape` sont en `ON UPDATE RESTRICT`, car MySQL interdit une action en cascade sur une colonne soumise à un CHECK.
- **Unicité de l'e-mail** : `unique(agenceId, email)` (RG 3). Un voyageur peut avoir un compte chez deux agences avec la même adresse. L'unicité de l'e-mail du personnel sur toute la plateforme (connexion par `/connexion`) sera vérifiée par l'application en E2, car MySQL n'a pas d'index unique partiel.
- **Écarts avec le §5.2** : `Circuit.difficulte` en enum à 3 niveaux, `ItineraireCalcule` avec étapes nullables et champ `difficulteCumulee` ajouté (§6.3), `creePar` devient `creeParId`. Détail et justifications dans `docs/ERD.md`.
- **Projet en ESM** (`"type": "module"`) : le client Prisma 7 généré est un module ES ; les scripts `tsx` (seed) l'exigent.
- **Prisma 7 ne régénère plus le client après `migrate dev`** : le script `db:migrate` enchaîne les deux commandes.
- **Base de test séparée `greentrek_test`** : au démarrage des tests d'intégration, `prisma migrate deploy` applique les migrations manquantes. Cette commande est non destructive, contrairement à `migrate reset` que Prisma 7 bloque quand il est lancé par un agent IA. Les tables sont vidées (TRUNCATE) avant chaque test. Garde-fou : le code refuse toute base dont le nom ne finit pas par `_test`. Tests exécutés en série (base partagée).
- **Mots de passe hachés avec `bcryptjs`** (coût 10) : implémentation en JavaScript pur, sans compilation native.
- **Seed minimal** : 3 plans fictifs, 3 agences (Green Trek Mada réelle, Démo Alpha et Démo Beta fictives), 13 utilisateurs fictifs, 3 abonnements simulés, 4 partenaires réels de Green Trek (détails en `TODO(données terrain)`). Le graphe est reporté en E4/E5.

## Captures d'écran à prendre

- E0 : page d'accueil provisoire (palette) et réponse JSON de `/api/health` avec `"database": "connectée"`.
- E1 : ERD exporté depuis mermaid.live ou MySQL Workbench ; résultat de `npm test` (tests d'intégration des contraintes).

## Comptes de démonstration

Mot de passe commun à tous les comptes : **`Demo2026!`** (démonstration locale uniquement). Toutes les personnes sont fictives ; les adresses utilisent le domaine réservé `.test`.

| Rôle | Green Trek Mada | Démo Alpha (fictive) | Démo Beta (fictive) |
|---|---|---|---|
| SUPER_ADMIN | `superadmin@greentrek-saas.test` (toutes agences) | | |
| ADMIN_AGENCE | `admin@green-trek-mada.test` | `admin@demo-alpha.test` | `admin@demo-beta.test` |
| STAFF | `staff@green-trek-mada.test` | `staff@demo-alpha.test` | `staff@demo-beta.test` |
| GUIDE | `guide@green-trek-mada.test` | `guide@demo-alpha.test` | `guide@demo-beta.test` |
| CLIENT | `client@green-trek-mada.test` | `client@demo-alpha.test` | `client@demo-beta.test` |

Abonnements simulés : Green Trek Mada en plan Pro (actif) ; Démo Alpha et Démo Beta en essai (30 jours).
