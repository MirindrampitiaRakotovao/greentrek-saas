# Suivi d'avancement

Fichier tenu à jour par Claude Code à chaque étape. Il alimente le mémoire : ne jamais marquer « fait » ce qui n'est pas testé.

## État des étapes

| Étape | Statut | Date | Remarques |
|---|---|---|---|
| E0 Initialisation | En cours | 2026-09-28 | Code prêt ; typecheck, lint, test et build verts. Reste : création de la base MySQL et vérification de `/api/health` par l'étudiant |
| E1 Schéma Prisma | À faire | | |
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

## Captures d'écran à prendre

- E0 : page d'accueil provisoire (palette) et réponse JSON de `/api/health` avec `"database": "connectée"`.

## Comptes de démonstration

(à remplir après le seed)
