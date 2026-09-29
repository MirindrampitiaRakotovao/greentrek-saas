# Suivi d'avancement

Fichier tenu à jour par Claude Code à chaque étape. Il alimente le mémoire : ne jamais marquer « fait » ce qui n'est pas testé.

## État des étapes

| Étape | Statut | Date | Remarques |
|---|---|---|---|
| E0 Initialisation | Fait | 2026-09-28 | Typecheck, lint, test et build verts ; base MySQL créée ; `/api/health` renvoie 200 « connectée » (vérifié chez l'étudiant) |
| E1 Schéma Prisma | Fait | 2026-09-28 | 19 tables et 18 CHECK migrés, seed OK, ERD rédigé ; typecheck, lint et build verts ; `npm test` 23/23 (3 unitaires, 20 d'intégration) chez l'étudiant |
| E2 Auth et multi-tenant | Fait | 2026-09-28 | Typecheck, lint, 167 tests, build et 14 scénarios de bout en bout verts ; parcours vérifiés dans le navigateur par l'étudiant (connexion admin, inscription d'agence, connexion client, super admin) |
| E3 Fondations back-office | Fait | 2026-09-28 | Validé par l'étudiant. Complété par la refonte visuelle des tableaux de bord (voir « Refonte des tableaux de bord ») |
| E4 Circuits et étapes | Fait | 2026-09-29 | Validé par l'étudiant, y compris la carte au style Google Maps et les 27 lieux réels de la côte Est |
| E5 Éditeur de graphe | Fait | 2026-09-29 | Validé par l'étudiant (333 tests, parcours complet dans le navigateur) |
| E6 Algorithmes | Fait | 2026-09-29 | Validé par l'étudiant : algorithmes (45 tests), calcul d'itinéraire, comparaison Dijkstra / A*, performances, tracé réel des circuits |
| E7 Départs | Fait | 2026-09-29 | Validé par l'étudiant : typecheck, lint, 415 tests, build et parcours dans le navigateur verts (création, statut automatique, annulation en cascade, vue du guide, isolation) |
| E8 Site vitrine | Fait | 2026-09-29 | Validé par l'étudiant : E8a (données publiques, recherche, détail d'un circuit), E8b (accueil d'après la maquette), E8c (photos sous licence libre avec crédits, partenaires illustrés, titre script, cercles flous) ; typecheck, lint, 436 tests, build et parcours dans le navigateur verts |
| E9 Réservation client | À faire | | |
| E10 Back-office opérationnel | En partie | 2026-09-28 | Tableau de bord et KPIs avancés à la demande de l'étudiant (refonte des tableaux de bord). Reste : gestion des réservations, clients, paiements |
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

### E2a — Isolation des données (2026-09-28)

- **Helper tenant `getTenantDb(agenceId)`** (`src/lib/tenant.ts`) : extension Prisma (`$extends`, `query.$allModels.$allOperations`) qui intercepte **toutes** les opérations avant leur envoi à MySQL. Le code métier ne peut donc pas « oublier » le filtre.
  - Lectures, modifications, suppressions, agrégats : la condition d'agence est ajoutée au `where` par un `AND`. Un filtre `agenceId` fourni par l'appelant ne peut pas la remplacer.
  - Créations : `agenceId` est imposé ; une autre valeur est refusée (`TenantViolationError`). Déplacer une donnée vers une autre agence est refusé.
  - Tables de liaison (`CircuitEtape`, `CircuitPartenaire`, `Participant`, `Paiement`) : filtrage par le parent (`circuit: { agenceId }`, `reservation: { agenceId }`).
  - **Références** : chaque clé étrangère écrite doit viser une ligne de la même agence (ex. un tronçon ne peut pas relier une étape d'une autre agence, RG 6 et RG 20).
  - Écritures imbriquées (`create`, `connect`… dans `data`) interdites : elles contourneraient le contrôle des références.
  - Table `Agence` : une agence ne voit et ne modifie qu'elle-même ; création et suppression réservées au super admin. Table `Plan` : lecture seule.
  - Requêtes SQL brutes (`$queryRaw`…) retirées du type `TenantDb`.
- **Configuration explicite** (`src/lib/tenant-config.ts`) : portée et clés étrangères de chaque table, lisibles dans le mémoire. Un test unitaire vérifie qu'elle reste alignée sur le schéma (toute nouvelle table ou clé étrangère non déclarée fait échouer le test).
- **Règle ESLint** `no-restricted-imports` : importer le client brut `@/lib/db` est une erreur dans `src/`, sauf dans le helper, `admin-db.ts` (super admin et authentification) et la route de santé. La règle « jamais de requête sans filtre `agenceId` » est ainsi vérifiée par l'outillage, pas seulement par convention.
- **Convention de typage** : le code applicatif passe `agenceId` explicitement à la création (typage Prisma strict, pas de conversion forcée) ; le helper vérifie qu'il s'agit bien de l'agence courante.
- **Matrice RBAC** (`src/lib/permissions.ts`) : traduction du §3 en données, avec `can(role, action, ressource)` et `assertCan`. Interprétations, faute de précision dans le §3 : guides et partenaires en CLMS pour ADMIN_AGENCE et en lecture pour STAFF (le §7.3 les rattache à la gestion de l'agence) ; abonnement en lecture pour ADMIN_AGENCE ; action « annuler » ajoutée pour les réservations, action « moderer » pour les avis.
- **Tests d'isolation** (`tests/integration/isolation.test.ts`, 35 tests) : deux agences complètes ; le client de A tente de lire, lister, compter, agréger, modifier, supprimer, créer et référencer des données de B (par identifiant direct, par liste et par relation, y compris dans une transaction). **Contre-épreuve** : avec le filtre d'agence désactivé, 19 de ces tests échouent. Les tests détectent donc bien une fuite ; les 16 autres portent sur les contrôles de création et de référence, qui sont indépendants.
- **Limite connue (à citer dans le mémoire)** : l'isolation repose sur la discipline « passer par le helper », imposée par ESLint et la revue de code. Une isolation au niveau de la base (Row-Level Security) n'existe pas dans MySQL ; elle serait possible avec PostgreSQL.

### E2b — Authentification et onboarding (2026-09-28)

- **Auth.js v5 (`next-auth@5.0.0-beta.32`, version fixée)** : encore en bêta, mais c'est la version prévue pour l'App Router et elle déclare Next 16 compatible. Fournisseur Credentials (e-mail et mot de passe). Session en **jeton JWT** chiffré dans un cookie (obligatoire avec Credentials), durée 8 h, contenant `userId`, `role`, `agenceId`, `agenceSlug` (§4). `trustHost: true` : démonstration locale.
- **Configuration en deux fichiers** : `src/auth.config.ts` (sans base de données, utilisé par `proxy.ts`) et `src/auth.ts` (complet). C'est le découpage recommandé par Auth.js : le proxy s'exécute sur chaque requête et doit rester léger.
- **Deux portes de connexion** (décision d'E1) : `/connexion` pour le personnel et le super admin, `/a/[slug]/connexion` pour les clients de CETTE agence. Un client ne peut pas entrer par `/connexion`, ni par le site d'une autre agence ; le personnel ne peut pas entrer par la porte client.
- **Sécurité de la connexion** :
  - un seul message d'erreur, quelle que soit la cause (compte inconnu, mauvais mot de passe, compte désactivé, agence suspendue), pour ne pas révéler quels comptes existent ;
  - comparaison bcrypt effectuée même si le compte n'existe pas (empreinte factice), pour un temps de réponse constant ;
  - validation Zod côté navigateur (confort) ET côté serveur (qui fait foi) ;
  - protection CSRF fournie par Auth.js (jeton CSRF) et par les actions serveur de Next.js (vérification de l'origine).
- **Contrôle d'accès en couches** (défense en profondeur, recommandation de la documentation Next.js 16) :
  1. `src/proxy.ts` (le nouveau nom du middleware dans Next 16) : redirection **optimiste** des visiteurs sans cookie de session, sans accès à la base ;
  2. `src/lib/auth/session.ts` : `requireUser` / `requireAgencyUser`, appelés en tête de chaque page protégée. Ce sont les vrais contrôles : **relecture de l'utilisateur en base à chaque requête** (dédupliquée par `cache` de React) ;
  3. `getTenantDb(agenceId)`, où `agenceId` vient de la base, jamais du navigateur.
- **RG 19 appliquée immédiatement** : un jeton JWT ne se révoque pas. Grâce à la relecture en base, suspendre une agence ou désactiver un compte coupe l'accès dès la requête suivante, sans attendre l'expiration du jeton (vérifié de bout en bout, voir ci-dessous). Une agence suspendue disparaît aussi du public (404 sur ses pages).
- **Onboarding `/inscription-agence`** : React Hook Form + Zod. Une seule transaction crée l'Agence, l'ADMIN_AGENCE (mot de passe haché) et un Abonnement ESSAI de 30 jours sur le plan « ESSAI ». Contrôles : slug unique (vérifié avant, puis garanti par l'index unique en cas d'inscriptions simultanées), slugs réservés (`admin`, `api`, `dashboard`…), e-mail du personnel unique sur toute la plateforme (`isStaffEmailTaken`), mot de passe d'au moins 8 caractères avec majuscule, minuscule et chiffre (72 au maximum, limite de bcrypt). Connexion automatique après l'inscription.
- **Logique séparée de l'interface** : `authenticate`, `loadActiveUser`, `isStaffEmailTaken` et `registerAgency` sont des fonctions qui reçoivent le client Prisma en paramètre, testées en intégration sans navigateur. Les actions serveur (`src/lib/actions/auth.ts`) ne font que valider et appeler ces fonctions.
- **Pages provisoires** `/dashboard`, `/admin`, `/a/[slug]/mon-compte` : affichent l'utilisateur, son rôle et son agence (le vrai back-office arrive en E3). Page d'aiguillage `/espace` : envoie chaque rôle vers son espace après la connexion.
- **Tests** : 43 tests supplémentaires (validations Zod et slug en unitaire ; authentification, relecture RG 19, unicité de l'e-mail et onboarding en intégration). **Tests de bout en bout** (serveur de production, connexions HTTP réelles par Auth.js avec les comptes du seed) : redirections du proxy, accès par rôle, client refusé sur une autre agence et sur `/connexion`, isolation entre Green Trek et Démo Alpha, suspension d'une agence pendant une session ouverte, puis réactivation.
- **Reporté** : inscription des clients (E9, avec le compte client) ; limitation des tentatives de connexion (P2, §12).
- **Correctif après test par l'étudiant** : en développement, le client Prisma mis en cache sur `globalThis` (pour le rechargement à chaud) survivait à un `prisma generate` ; un serveur `npm run dev` lancé avant E1 gardait un client sans tables (`Cannot read properties of undefined (reading 'findFirst')`). Le cache n'est désormais réutilisé que s'il provient de la classe PrismaClient actuelle (`instanceof`).
- **Correctifs de sécurité après test dans le navigateur** :
  - *Identifiants dans l'URL* : ouvert depuis l'adresse réseau du poste, le formulaire était parti avant le chargement de JavaScript (ressources de développement bloquées pour cette origine), donc en GET par défaut (`/connexion?email=…&password=…`). Les formulaires sont désormais en `method="post"` : même sans JavaScript, les identifiants ne passent jamais dans l'URL.
  - *Mots de passe dans le journal de développement* : Next.js 16 affiche par défaut les arguments des actions serveur ; désactivé par `logging.serverFunctions: false` (§12).
  - *Test sur téléphone* : origines de développement supplémentaires via `ALLOWED_DEV_ORIGINS` (`.env`), lues par `next.config.ts`.
  - *Avertissement d'hydratation* : provoqué par des extensions du navigateur qui ajoutent des attributs à `<html>` ; `suppressHydrationWarning` sur cette seule balise.

### E3a — Layout du back-office, équipe et profil (2026-09-28)

- **Correctif du helper tenant (transactions)** : le contrôle des références interrogeait la base hors de la transaction en cours ; créer un utilisateur puis sa fiche Guide dans la même transaction aurait été refusé à tort. Désormais :
  - le contrôle passe par le client **confiné** lui-même (le filtre d'agence y est ajouté automatiquement) ;
  - `db.$tenantTransaction(fn)` mémorise la transaction en cours (`AsyncLocalStorage` de Node) pour que ces contrôles s'y exécutent et voient ses écritures non encore validées ;
  - `$transaction` est retiré du type `TenantDb` pour imposer `$tenantTransaction`.
  Deux tests d'isolation ajoutés : référence vers une ligne créée dans la même transaction acceptée ; référence vers l'agence B refusée, avec annulation complète de la transaction.
- **Architecture d'un module** (appliquée à l'équipe, reprise pour les suivants) : page serveur (`requireAgencyUser` + contrôle du rôle) → formulaire client (React Hook Form + Zod) → action serveur (`requireAgencyUser` + `assertCan` + Zod) → service métier (`src/lib/services/`, reçoit le client confiné, renvoie un `ServiceResult`) → Prisma. Les règles de gestion vivent dans les services, testés en intégration sans navigateur.
- **Layout `/dashboard`** (§8.6) : barre latérale générée depuis la matrice des permissions (`navigationFor(role)`), menu repliable sur mobile, nom de l'agence et de l'utilisateur, déconnexion. Masquer un lien n'est qu'un confort : chaque page revérifie les droits (Next.js ne réexécute pas toujours le layout lors d'une navigation).
- **Équipe `/dashboard/equipe`** : liste paginée côté serveur (`?page=n`, 20 par page, §12) ; ADMIN_AGENCE crée, modifie et désactive ; STAFF consulte ; GUIDE n'y a pas accès. Règles appliquées (décisions A à D validées) :
  - mot de passe initial saisi par l'administrateur (aucun e-mail envoyé), changé ensuite par le membre ;
  - e-mail du personnel unique sur toute la plateforme ; même e-mail qu'un client de l'agence refusé (index unique) ;
  - pas de suppression d'utilisateur, seulement la désactivation (accès coupé immédiatement, RG 19) ;
  - on ne peut ni se désactiver soi-même ni changer son propre rôle ; l'agence garde toujours au moins un ADMIN_AGENCE actif ;
  - un compte GUIDE reçoit automatiquement sa fiche Guide ; quitter le rôle GUIDE détache la fiche sans la supprimer (départs déjà encadrés).
- **Mon profil `/dashboard/profil`** : identité et téléphone ; changement de mot de passe avec l'ancien exigé (protection si une session est laissée ouverte).
- **Dates** affichées en français dans le fuseau de Madagascar (`Indian/Antananarivo`), identiques côté serveur et navigateur.
- **Tests** : 33 tests supplémentaires (règles de l'équipe et du profil en intégration ; menu selon le rôle, pagination, format des dates en unitaire). Contrôle de bout en bout sur le serveur de production : accès aux pages selon le rôle (admin, staff, guide) et 404 pour un membre d'une autre agence.

### E3b — Paramètres, partenaires et guides (2026-09-28)

- **Défaut corrigé (présent depuis E3a)** : chaque formulaire est validé deux fois, dans le navigateur puis sur le serveur, et le serveur reçoit les valeurs **déjà transformées** (« "" » devenu `null`). Le schéma du téléphone n'acceptait qu'une chaîne : un téléphone vide dans « Mon profil » ou « Modifier un membre » aurait été refusé par le serveur (défaut reproduit, puis corrigé). Les briques de validation partagées (`src/lib/validators/common.ts`) acceptent désormais la saisie brute ET sa forme transformée (validation idempotente), et un test de non-régression vérifie cette propriété pour **tous** les schémas de formulaire.
- **Paramètres de l'agence** (`/dashboard/parametres`, ADMIN_AGENCE seulement) : nom, présentation, coordonnées, devise (MGA, EUR, USD), adresse du logo (URL `http(s)` uniquement : une adresse `javascript:` est refusée). Le slug est affiché mais non modifiable (il fait partie des adresses publiques). La couleur principale (thème par agence) reste en P2.
- **Partenaires** (`/dashboard/partenaires`) : ADMIN_AGENCE crée, modifie, supprime ; STAFF consulte. Coordonnées GPS facultatives, les deux ou aucune, bornées (saisie de relevés réels uniquement, pas de valeurs inventées ; sélection sur carte en E4). Suppression refusée si le partenaire est inclus dans un circuit (message invitant à le désactiver).
- **Guides** (`/dashboard/guides`) : fiches avec langues (liste fermée : français, malagasy, anglais, allemand, italien, espagnol, chinois), expérience, présentation, statut. Lien facultatif vers un compte : uniquement un compte GUIDE de l'agence, sans autre fiche. Suppression refusée si la fiche encadre un départ ou est reliée à un compte.
- **Montants** : l'Ariary s'affiche « 25 000 Ar » (usage local, §8.4), alors que le formatage standard `Intl` afficherait « 25 000 MGA » ; les autres devises utilisent `Intl`.
- **Menu** : Guides et Partenaires visibles par ADMIN_AGENCE et STAFF, Paramètres par ADMIN_AGENCE seulement, rien de tout cela pour GUIDE (dérivé de la matrice des permissions, testé).
- **Tests** : 35 tests supplémentaires (idempotence et transformations des schémas, format des montants, menu selon le rôle en unitaire ; règles des paramètres, partenaires et guides, isolation comprise, en intégration). Contrôle de bout en bout sur le serveur de production : accès aux pages selon le rôle ; partenaire et guide de Green Trek en 404 pour l'administrateur de Démo Alpha.

### Refonte des tableaux de bord (2026-09-28, demandée par l'étudiant)

- **Demande** : reprendre la maquette de tableau de bord fournie (image « COINEST », référence visuelle tierce : on reprend la structure et la densité, ni le nom ni les textes), pour les trois espaces connectés, avec un tableau de bord « bien rempli ».
- **Décisions de l'étudiant** : mise en page de la maquette aux couleurs Green Trek (teal à la place du vert, teintes claires de teal à la place du vert citron, sable pour les boutons d'accent : pas d'écart avec le §8.2) ; données de démonstration fictives dès maintenant ; back-office d'agence, console super admin ET espace client (déconseillé pour l'espace client, qui relève du site vitrine : choix de l'étudiant retenu).
- **Écarts assumés avec le plan** : une partie d'E10 (indicateurs, graphiques Recharts) et d'E12 (seed de démonstration) est avancée.
- **Coque commune** (`src/components/shell/app-shell.tsx`) : barre latérale (élément actif en « pilule », encart en bas), barre supérieure (titre, recherche de page réelle parmi les entrées du menu, cloche des notifications in-app lues en base, utilisateur), pied de page. Menu repliable sur mobile.
- **Indicateurs calculés en direct** (`src/lib/dashboard/`), via le client confiné (isolation conservée), définitions documentées dans le code : réservations du mois (hors annulations) et évolution, montant réservé, paiements encaissés (statut VALIDE, par date de paiement), taux de remplissage des départs à venir, répartition par statut, circuits les plus réservés, abonnement et limites du plan, activité récente (événements réels : réservations, paiements, annulations). Vue dédiée pour le GUIDE (ses départs seulement), vue plateforme pour le SUPER_ADMIN (comptages globaux ; montants par agence, car les devises peuvent différer), vue client (ses réservations et ses paiements).
- **Calendrier** : jours et mois en heure de Madagascar (UTC+3, sans heure d'été) ; les colonnes SQL `DATE` (dates de départ) sont comparées à la date calendaire locale (`calendarDate`), sinon les départs d'hier seraient comptés « à venir ».
- **Règles de visualisation** (guide de visualisation appliqué) : un seul axe vertical (les deux séries de la courbe sont en Ariary) ; couleurs des séries validées par script (luminosité, saturation, séparation pour les daltoniens) : les teals d'origine étaient trop peu saturés, d'où `#00899E` et le sable `#C98A1B` ; contraste du sable < 3:1, donc légende, infobulle et tableau accessible pour les lecteurs d'écran ; texte jamais dans la couleur de la série ; statuts toujours écrits en toutes lettres.
- **Seed de démonstration** (`prisma/demo-data.ts`) : fonction pure et déterministe (graine fixe), 10 circuits, 39 départs, 80 à 95 réservations sur 12 mois (dates relatives à la date du seed), participants, paiements simulés et notifications ; 8 voyageurs fictifs et un guide sans compte par agence. Circuits de Green Trek marqués « [DÉMO] », prix, durées et capacités TODO(données terrain). Tests : RG 10, 11, 13, 14, 16, cohérence des dates (aucun événement dans le futur), déterminisme, volumes du §11.
  - Les circuits de démonstration sont publiés **sans étapes** pour l'instant : les étapes arrivent en E4, qui les ajoutera au seed (RG 4 : au moins deux étapes).
- **Vérification visuelle** : captures d'écran automatisées (Chrome sans interface, connexion par le vrai formulaire) des sept écrans sur ordinateur et sur mobile, avec détection du débordement horizontal. Trois défauts trouvés et corrigés :
  - un tableau masqué pour les lecteurs d'écran allongeait la page (`sr-only` est sans effet sur un `<table>` : il est désormais dans une `div` masquée) ;
  - dans une grille, un tableau large élargissait sa colonne (`min-w-0` sur les colonnes) ;
  - les libellés `sr-only` d'un tableau défilant débordaient de la page (conteneurs défilants en `position: relative`).
- **Tests** : 36 tests supplémentaires (générateur de démonstration, calendrier, séries des graphiques en unitaire ; indicateurs des quatre tableaux de bord calculés à la main et isolation entre agences en intégration).

### E4 — Circuits et étapes sur carte (2026-09-29)

- **Décisions validées** : coordonnées issues d'OpenStreetMap avec source citée (A) ; réordonnancement par boutons ↑ ↓ (B) ; image de circuit par adresse web (C).
- **Coordonnées réelles, rien d'inventé** : les étapes de Green Trek viennent d'une requête OpenStreetMap (Nominatim et Overpass, 2026-09-29) sur les lieux nommés à moins de 12 km de Mahambo : Mahambo, Mahambo Doany, Morafeno, Agnalambany, Antsikafoka, Ambinany Iazafo, Tanambao Sahorana, Namahoaka (`prisma/osm-mahambo.ts`, identifiant de nœud OSM et licence ODbL cités). **Ambodiforaha n'existe pas dans OpenStreetMap** : il n'est pas créé ; l'agence le placera sur la carte à partir d'un relevé GPS. TODO(données terrain) : vérifier que ces lieux sont sur les sentiers de l'agence. Les étapes des agences fictives sont marquées « (fictif) ».
- **Carte Leaflet + tuiles OpenStreetMap** (§9) : `react-leaflet` 5 (compatible React 19), module chargé uniquement dans le navigateur (import dynamique sans rendu serveur : Leaflet a besoin de `window`). Marqueurs HTML (`divIcon`) numérotés aux couleurs Green Trek (les images de marqueur par défaut de Leaflet se chargent mal avec les bundlers). Attribution OpenStreetMap affichée. Rappel §12 : les tuiles exigent Internet.
- **Étapes** (`/dashboard/etapes`, nœuds du graphe) : clic sur la carte pour placer une étape (formulaire prérempli), glisser un marqueur pour corriger sa position (enregistré aussitôt), liste filtrable. RG 8 : suppression refusée avec un message indiquant ce qui utilise l'étape (tronçons, circuits, prestations), en plus des clés étrangères RESTRICT. Lecture seule pour le GUIDE.
- **Circuits** (`/dashboard/circuits`) : liste en cartes (statut, difficulté, durée, étapes, départs, « à partir de X Ar / pers. »), création (en brouillon, puis redirection vers la fiche pour ajouter les étapes), fiche avec publication, itinéraire, partenaires inclus et informations.
  - **RG 4** : publication refusée sous deux étapes ; un circuit publié ne peut pas descendre sous deux étapes. Rangs toujours 1..n sans trou : ajout en fin, échange avec la voisine pour monter ou descendre (en passant par un rang temporaire libre, car l'index unique (circuit, rang) interdit deux étapes au même rang même un instant), renumérotation après un retrait. La même étape ne peut pas se suivre deux fois, mais une boucle (retour au départ) est permise.
  - **RG 9** : seul un circuit publié sera visible sur le site vitrine (E8).
  - Suppression d'un circuit seulement s'il n'a aucun départ ; sinon archivage.
  - Slug unique par agence (vérifié, puis garanti par l'index unique).
  - Tracé indicatif en ligne droite entre les étapes : les chemins réels arrivent avec les tronçons (E5) et les algorithmes (E6).
- **Partenaires inclus** (`CircuitPartenaire`) : prestation, étape facultative, prix unitaire facultatif, inclus ou en option. Le helper tenant refuse un partenaire ou une étape d'une autre agence.
- **Seed** : 17 étapes (8 réelles pour Green Trek, 9 fictives), itinéraires de 2 à 4 étapes pour les 10 circuits (le défaut noté lors de la refonte, circuits publiés sans étapes, est corrigé), 4 prestations des partenaires réels de Green Trek (prix TODO(données terrain)).
- **Tests** : 26 tests supplémentaires (règles des étapes et des circuits, rangs, isolation en intégration ; graphes de démonstration en unitaire, dont « aucune coordonnée inventée pour Green Trek »). Contrôle dans un vrai navigateur : clic sur la carte → formulaire « Nouvelle étape » ; guide en lecture seule ; guide renvoyé depuis la création de circuit ; aucun débordement sur mobile.

### E4 bis — Carte au style Google Maps et lieux de la côte Est (2026-09-29, demande de l'étudiant)

- **Demande** : une carte au design de Google Maps (capture fournie) et davantage de lieux réels de l'Est de Madagascar pour une démonstration réaliste.
- **19 lieux réels ajoutés** (OpenStreetMap, requête Overpass à 70 km de Mahambo, identifiants de nœuds cités) : 5 villes (Fenoarivo Atsinanana, Mahavelona/Foulpointe, Vavatenina, Soanierana Ivongo, Ambodifototra sur Sainte-Marie) et 14 villages de la côte et de l'arrière-pays. Le graphe de Green Trek compte 27 lieux réels. Test : toutes les coordonnées viennent de la liste OpenStreetMap et se trouvent dans la bande côtière Est.
- **Fonds de carte** (`src/lib/map/tiles.ts`), tous gratuits et sans carte bancaire :
  - Plan : Stadia Maps « OSM Bright » (rendu proche de Google Maps ; sans clé en développement local, compte gratuit requis en ligne) ;
  - Satellite : Esri World Imagery ; Relief : OpenTopoMap ; OSM : tuiles standard.
  - **Écart avec le §9** (tuiles OSM standard par défaut) : seul le style change, les données restent OpenStreetMap. Google Maps est exclu (licence de l'API, clé et facturation). **CARTO, essayé d'abord, exige désormais une clé** : ses tuiles affichaient « API KEY REQUIRED ». La première vérification ne regardait que le code HTTP 200 ; les tuiles sont désormais contrôlées sur les images elles-mêmes.
- **Interface** (`src/components/circuits/map-explorer.tsx`, `src/components/map/leaflet-map.tsx`) : carte plein cadre ; panneau flottant avec recherche (insensible aux accents), liste des résultats et fiche du lieu ; pastilles de filtre par type ; épingles en goutte (rouge et nom affiché pour le lieu sélectionné) ; recentrer et zoom en bas à droite ; « Calques » en bas à gauche avec de vraies vignettes. Sur mobile, le panneau passe sous la carte.
- **Fiche d'un lieu, uniquement des données réelles** : vue satellite réelle du lieu (tuile Esri calculée depuis ses coordonnées) à la place d'une photo, pas de météo inventée ; actions Centrer, Modifier, Copier les coordonnées, Ouvrir dans OpenStreetMap ; circuits passant par le lieu ; « À proximité » : les 4 étapes les plus proches à vol d'oiseau.
- **Haversine** (`src/lib/graph/haversine.ts`) : fonction pure, testée (distance de référence Paris–Londres, 1° de latitude, Mahambo–Fénérive ≈ 12,7 km, symétrie). Elle servira aux distances estimées des tronçons (E5) et à l'heuristique de A* (E6).
- **Défauts trouvés par les tests et les captures, puis corrigés** :
  - vignettes des calques pointant sur une tuile du canal du Mozambique (coordonnées de tuile erronées) : test ajouté qui vérifie que chaque vignette montre Mahambo ;
  - bouton « Calques » caché sous le panneau flottant (inaccessible) : commandes de gauche décalées sur grand écran ;
  - sur mobile, épingles repoussées hors de l'écran (marge du panneau appliquée alors que le panneau est sous la carte) : marge réservée au grand écran ;
  - fiche d'un lieu ouverte au milieu (position de défilement de la liste conservée) : retour en haut à chaque changement de vue.

### E5 — Éditeur de graphe : tronçons (2026-09-29)

- **Décisions validées** : sinuosité 1,3 (A) ; règle de Naismith adaptée à 4 km/h + 1 h par 600 m de dénivelé positif (B) ; tronçons de démonstration entre plus proches voisins (C) ; éditeur sur la page de la carte, avec un sélecteur Étapes / Tronçons (D).
- **Estimations** (`src/lib/graph/config.ts`, `estimation.ts`, fonctions pures testées) :
  - distance estimée = Haversine × 1,3, arrondie à 10 m, jamais nulle (RG 6). Justification : un sentier mesure en général 1,2 à 1,4 fois la ligne droite ; valeur médiane, à ajuster avec les relevés GPS ;
  - durée estimée (règle de Naismith adaptée) = distance / 4 km/h + dénivelé positif / 600 m/h ; la descente n'est pas comptée ; arrondie à la minute supérieure. 4 km/h au lieu des 5 km/h d'origine : groupe de randonneurs sur sentiers tropicaux.
  - Ces valeurs sont seulement PROPOSÉES : saisir une distance décoche automatiquement « distance estimée » (mesure de terrain).
- **Règles** (`src/lib/services/troncons.ts`) : RG 6 (étapes distinctes, validation Zod + CHECK SQL ; même agence, helper tenant), RG 7 (un tronçon par sens, index unique + message clair), **doublon inverse** (décision E1) : si A→B existe et que A→B ou B→A est à double sens, B→A est refusé ; deux sens uniques A→B et B→A restent permis (montée et descente de durées différentes). RG 8 : supprimer le dernier tronçon d'une étape la rend de nouveau supprimable.
- **Éditeur** (page « Carte du réseau », §6.5) : vue Tronçons avec liste filtrable, légende (trait plein = mesuré, pointillés = estimé), création par clic sur l'étape de départ puis d'arrivée (formulaire prérempli avec la distance à vol d'oiseau affichée), clic sur un tronçon (ou dans la fiche d'un lieu) pour le modifier ou le supprimer. Lecture seule pour le GUIDE. Dans la vue Étapes, les tronçons apparaissent en fond.
- **Tronçons de démonstration** (`generateDemoEdges`, fonction pure testée) : chaque lieu relié à ses 3 plus proches voisins à moins de 15 km, plus les étapes consécutives des itinéraires, puis les groupes isolés du continent reliés par la paire la plus proche (l'arrière-pays de Vavatenina). Toutes les distances et durées sont estimées (`distanceEstimee = true`, `TODO(données terrain)`). **L'île Sainte-Marie n'est pas reliée** : pas de tronçon à pied à travers la mer. Cela servira à démontrer en E6 le cas « aucun chemin » (§6.4). Green Trek : 42 tronçons ; seed total : 57.
- **Correctifs de qualité** : la suppression des accents dans la recherche et les slugs s'écrit désormais `\p{Diacritic}` (l'outil d'écriture avait remplacé les échappements `\u0300-\u036f` par des caractères invisibles, fonctionnels mais illisibles) ; croix native du navigateur masquée dans la recherche de la carte (deux croix).
- **Tests** : 27 tests supplémentaires (estimations ; tronçons de démonstration : pas de boucle, une arête par paire, itinéraires couverts, continent connexe et île séparée ; service : RG 6, RG 7, doublon inverse, modification, suppression, isolation). Parcours complet dans un vrai navigateur : création Mahambo → Vavatenina (35,19 km proposés = 27,07 km × 1,3 ; 528 min), doublon refusé, réouverture, suppression.

### E6a — Algorithmes de plus court chemin (2026-09-29)

- **Décisions validées** : pénalité de difficulté (A), heuristique calibrée sur les données (B), Held-Karp pour l'ordre libre (C), benchmark médian avec export CSV (D).
- **Module pur** `src/lib/graph/` (aucune dépendance à la base ni à l'interface) :
  - `build.ts` : liste d'adjacence ; un tronçon à double sens donne deux arcs orientés ; refus clair d'un tronçon vers une étape inexistante (étape supprimée), d'une boucle ou d'un poids invalide (§6.4) ; un tronçon dupliqué est géré naturellement (l'arc le moins coûteux l'emporte).
  - `weights.ts` : w(e) = α·distance + β·durée (h) + γ·pénalité, avec pénalité = (difficulté − 1) × distance. Préréglages : Plus court (1, 0, 0), Plus rapide (0, 1, 0), Plus facile (1, 0, 2). α, β, γ ≥ 0 et α + β > 0, ce qui garantit w > 0.
  - `priority-queue.ts` : tas binaire écrit à la main (O(log n)), avec « entrées périmées » plutôt qu'une diminution de clé.
  - `search.ts` : **un seul moteur pour Dijkstra et A*** (f = g + h, avec h = 0 pour Dijkstra), pour une comparaison équitable ; arrêt dès que l'arrivée est traitée ; sorties du §6.3 (chemin, coût, distance, durée, difficulté cumulée et moyenne, nœuds explorés et leur ordre, temps).
  - `heuristic.ts` : h(n) = α·ρ·H(n, but) + β·H(n, but)/v, avec ρ = min(distance / vol d'oiseau) et v = max(vitesse à vol d'oiseau) calculés **sur les données**. Preuve de cohérence dans le code (inégalité triangulaire) : h(u) ≤ w(u,v) + h(v), donc h est admissible.
  - `waypoints.ts` : étapes imposées, ordre fixé (enchaînement) ou libre (Held-Karp, O(k²·2^k), limité à 8 étapes) ; indication du tronçon sans chemin.
  - `benchmark.ts` : graphes géométriques aléatoires reproductibles (graine), connexes, densité constante ; médiane des temps, moyenne des nœuds explorés, vérification des coûts identiques, export CSV (« ; » et virgule décimale).
- **Graphe de référence** (`tests/unit/graph/reference-graph.ts`, §11) : 8 nœuds, résultats calculés à la main et documentés. Les trois critères donnent **trois chemins optimaux différents** : Plus court A-B-D-F (11 km), Plus rapide A-C-E-F (2,5 h), Plus facile A-G-F (coût 12). Deux tronçons y sont volontairement plus courts que la ligne droite.
- **Contre-épreuve** : avec une heuristique « Haversine brute » (ρ = 1), A* renvoie un chemin **non optimal** sur le graphe de référence et 3 tests échouent. Cela justifie le calibrage sur les données.
- **Mesures (et une optimisation expliquée)** : A* explorait 56 à 72 % de nœuds en moins mais était 2 fois plus LENT que Dijkstra. Cause trouvée par la mesure : le calibrage de l'heuristique (un calcul de Haversine par arc du graphe) était refait à chaque recherche. Il est désormais calculé une fois par graphe et mémorisé (prétraitement, mesuré à part). Résultats (médiane sur 20 paires, graphes aléatoires, critère Plus court) :

| Nœuds | Dijkstra | A* | Nœuds explorés (Dijkstra → A*) | Calibrage A* (une fois) |
|---|---|---|---|---|
| 50 | 0,074 ms | 0,043 ms | 25 → 11 (−57 %) | 0,27 ms |
| 200 | 0,130 ms | 0,073 ms | 100 → 43 (−56 %) | 0,49 ms |
| 1 000 | 0,601 ms | 0,203 ms | 511 → 166 (−68 %) | 1,85 ms |
| 5 000 | 3,060 ms | 1,301 ms | 2 668 → 759 (−72 %) | 7,21 ms |

  Le calibrage est amorti dès la 4e recherche sur 5 000 nœuds. Pour « Plus facile », le gain est faible (≈ −20 % de nœuds) : l'heuristique ne peut pas anticiper la pénalité de difficulté (terme γ minoré par 0). Les coûts de Dijkstra et d'A* sont identiques sur toutes les paires, pour tous les critères. Mesures sur la machine de développement : les temps absolus varient d'une machine à l'autre, les rapports restent.
- **Tests** (45 pour le module) : graphe de référence (chemins et coûts à la main, sens inverse, cas limites §6.4 : aucun chemin, départ = arrivée, graphe à un nœud, étape inconnue, poids invalides, tronçon dupliqué, sens unique) ; propriétés sur des centaines de graphes aléatoires (même coût Dijkstra / A*, chemin continu fait d'arcs existants, coût recalculé = coût annoncé, A* explore moins) ; heuristique admissible et cohérente vérifiée nœud par nœud et arc par arc ; Held-Karp = force brute sur 30 cas ; benchmark reproductible, connexe et CSV.

### E6b — Calcul d'itinéraire dans l'application (2026-09-29)

- **Service** (`src/lib/services/itineraires.ts`) : charge les étapes et les tronçons de l'agence (client confiné), construit le graphe, lance le module pur et enregistre chaque résultat trouvé dans `ItineraireCalcule` : algorithme, critère, α, β, γ, métriques, auteur, et un instantané JSON du chemin (étapes, ordre retenu, tracé GeoJSON), lisible même si une étape est supprimée ensuite. Un calcul sans chemin n'est pas enregistré et renvoie un message clair nommant les deux étapes non reliées (§6.4).
- **Page « Calcul d'itinéraire »** (style du panneau « Itinéraires » de Google Maps) : départ et arrivée (listes ou clic sur la carte), inversion, étapes imposées (ordre fixé réordonnable, ou ordre libre Held-Karp), critère (Plus court, Plus rapide, Plus facile, ou α, β, γ personnalisés avec la formule affichée), algorithme (Dijkstra, A*, Comparer). Résultat : durée et distance, difficulté moyenne, coût, étapes de l'itinéraire, tracé plein sur la carte ; en mode Comparer, tableau coût / nœuds explorés / temps et **affichage sur la carte des nœuds explorés par chaque algorithme**. Historique paginé des calculs sous la carte.
- **Page « Performances »** (ADMIN_AGENCE, STAFF) : banc d'essai lancé côté serveur pour le critère choisi, deux graphiques Recharts séparés (temps médian ; nœuds explorés : jamais deux unités sur un même axe), tableau détaillé (dont le calibrage d'A* mesuré à part) et export CSV (encodage UTF-8 avec BOM pour Excel).
- **Tracé réel d'un circuit** (fiche circuit) : plus court chemin (A*, Plus court) passant par les étapes du circuit dans leur ordre, à travers les tronçons ; remplace les lignes droites sur la carte et met à jour `Circuit.distanceKm` (« cache calculé » du §5.2). Enregistré dans l'historique avec le circuit.
- **Permissions** : calcul d'itinéraire pour tout le personnel, GUIDE compris (lecture du réseau) ; banc d'essai et tracé des circuits pour ADMIN_AGENCE et STAFF.
- **Mesures sur les données réelles de Green Trek** (27 lieux, 42 tronçons estimés) : Fénérive-Est → Foulpointe, 45,51 km, même coût pour les deux algorithmes, 19 nœuds explorés par Dijkstra contre 8 par A* (−58 %). Vers Sainte-Marie : « Aucun chemin entre Fenoarivo Atsinanana et Ambodifototra » (île non reliée à pied).
- **Tests** : 8 tests d'intégration du service sur le graphe de référence chargé en base (résultats calculés à la main pour chaque critère, enregistrement de l'historique, comparaison, critère personnalisé, ordre libre, aucun chemin sans enregistrement, isolation, tracé de circuit). Parcours complet dans un vrai navigateur : comparaison, nœuds explorés, aucun chemin, ordre libre avec « Plus facile », historique, banc d'essai, tracé réel d'un circuit ; aucune erreur.

### E7 — Départs et disponibilités (2026-09-29)

- **Règles pures** (`src/lib/departs.ts`, testées unitairement) : places réservées (toutes les réservations sauf les annulées), statut automatique, date de fin proposée, chevauchement de deux périodes.
- **Statut automatique (RG 11)** : `ANNULEE` reste annulé (décision de l'agence) ; sinon `TERMINEE` si la date de fin est passée ; sinon `COMPLETE` si réservées ≥ places ; sinon `OUVERTE`. Il est recalculé dans la transaction de chaque changement (`refreshSessionStatut`, réutilisé à l'étape E9 pour les réservations). Le passage à `TERMINEE` se fait à l'affichage (`syncTermines`), faute de tâche planifiée dans une démo locale. Un départ complet redevient ouvert si une annulation ou une hausse du nombre de places libère de la place.
- **RG 10** : date de fin ≥ date de début, vérifiée par Zod (formulaire et serveur) puis par la contrainte CHECK en base. La date de fin est proposée d'après la durée du circuit (début + durée − 1 jour) tant qu'elle n'a pas été modifiée à la main. Pas de date de début passée à la création.
- **RG 13** : le nombre de places ne peut pas descendre sous le nombre de places déjà réservées. L'anti-surbooking des réservations simultanées sera traité à l'étape E9 (transaction).
- **Décisions validées par l'étudiant** :
  - A : départs possibles pour un circuit publié ou brouillon, pas archivé ; seuls les départs des circuits publiés seront visibles sur le site vitrine (E8) ;
  - B : places ≤ capacité maximale du circuit ;
  - C : un guide n'encadre pas deux départs non annulés dont les dates se chevauchent (jours inclus : finir le 12 et recommencer le 12 est refusé) ; guide actif obligatoire ;
  - D : l'annulation d'un départ, après confirmation, annule dans la même transaction ses réservations actives (`annuleeAt` renseigné) ; les remboursements relèvent de l'étape E10. Suppression définitive seulement si le départ n'a jamais reçu de réservation ;
  - E : liste groupée par mois (le calendrier reste un bonus non réalisé).
- **Prix** : le prix du départ, s'il est renseigné, remplace celui du circuit ; sinon le prix du circuit s'applique.
- **Dates** : colonnes SQL `DATE` lues à minuit UTC, donc formatées en UTC (`formatDateRange`) pour ne jamais décaler d'un jour ; « aujourd'hui » reste calculé dans le fuseau de Madagascar (`calendarDate`).
- **Pages** : `/dashboard/departs` (groupée par mois, filtres période, circuit et statut dans l'URL, pagination qui conserve les filtres), `/dashboard/departs/nouveau` (circuit présélectionné depuis la fiche circuit), `/dashboard/departs/[id]` (remplissage, encadrement, réservations, participants, modification, annulation). Section « Prochains départs » sur la fiche d'un circuit, lien « Départs » dans le menu.
- **GUIDE** : voit uniquement les départs qu'il encadre (liste et fiche, 404 sinon), en lecture seule, avec ses participants ; son tableau de bord renvoie vers la fiche de chaque départ.
- **Tests** : 17 tests d'intégration (création, prix, date passée, RG 10 par la contrainte CHECK, décisions A à D, RG 11, RG 13, passage à TERMINEE, annulation en cascade, suppression, filtres, vue du guide, isolation entre agences), 9 tests unitaires des règles et des dates, idempotence des deux schémas de formulaire. Seed vérifié : 39 départs, aucun écart de statut, aucun dépassement de capacité ni surbooking.
- **Parcours dans le navigateur** (serveur de production) : liste, départs passés, fiche avec réservations et participants, création (date de fin proposée, refus au-delà de la capacité, redirection vers la fiche), suppression, section de la fiche circuit, version mobile, guide limité à ses 14 départs sans bouton de création, 404 pour un départ d'un autre guide et pour l'administrateur d'une autre agence ; aucune erreur.

### E8a — Site vitrine : données publiques, recherche, détail d'un circuit (2026-09-29)

- **Sécurité des lectures publiques** : le visiteur n'a pas de session ; la page retrouve l'agence par son slug (`getVitrineAgency`, agence ACTIVE seulement : RG 19), puis toutes les lectures passent par le client confiné `getTenantDb(agence.id)` (`loadVitrine`). Toutes les règles de visibilité sont regroupées dans `src/lib/services/vitrine.ts` : circuits `PUBLIE` seulement (RG 9) ; départ proposé s'il est `OUVERTE`, pas encore commencé, sur un circuit publié, avec au moins une place libre. Seuls des champs publics sont sélectionnés : ni notes internes, ni clients, ni coût des prestations partenaires (prix unitaire).
- **Recherche (§7.1)** : date (départs à partir de cette date, une date passée est ramenée à aujourd'hui), nombre de voyageurs (places libres ≥ voyageurs, réservations annulées non comptées), difficulté. Sans date ni voyageurs, tous les circuits publiés sont listés, ceux qui ont un départ en premier. Filtres dans l'URL (formulaire GET : fonctionne sans JavaScript, recherche partageable) ; un paramètre invalide est ignoré au lieu de faire échouer la page.
- **Prix « à partir de »** : le plus bas des départs réservables (le prix spécifique d'un départ remplace celui du circuit), sinon le prix du circuit.
- **Pages** (groupe de routes `(vitrine)`, qui n'affecte ni la connexion ni l'espace client) : accueil provisoire (hero, recherche, circuits, prochains départs, partenaires), `/a/[slug]/circuits` (résultats), `/a/[slug]/circuits/[circuitSlug]` (carte avec le tracé réel calculé en E6, étapes par jour, prestations partenaires incluses ou en option, départs avec places libres et bouton « Réserver »), `/a/[slug]/reserver/[sessionId]` (page d'attente : récapitulatif du départ, tunnel en E9). En-tête avec menu mobile natif (`<details>`, sans JavaScript), pied de page teal et bande sable.
- **Décisions validées par l'étudiant** : A, visuels dessinés (paysages SVG sentier, côte et pirogue, village, choisis de façon stable par circuit) en attendant les photos de l'agence, `TODO(photos Green Trek)` ; une image renseignée sur le circuit est prioritaire. Tout reste local (démo hors ligne possible, sauf les tuiles de la carte) et sans question de droits. B, pas d'étoiles avant les avis (E12). C, pas de galerie de réseaux sociaux (comptes inconnus) ; coordonnées absentes affichées « à venir », `TODO(données terrain)`. D, bouton « Réserver » vers la page d'attente. E, landing SaaS `/` inchangée jusqu'à E11.
- **Photo du hero** (demande de l'étudiant) : plage bordée de cocotiers au lever du soleil, redimensionnée à 2 400 × 1 600 px (`public/images/hero-plage.jpg`, servie en formats optimisés par `next/image`), avec un voile teal pour garder le texte blanc lisible. Le texte alternatif ne nomme aucun lieu : la photo n'est pas présentée comme Mahambo. `TODO(photos Green Trek)` : confirmer la source et la licence de la photo (§8.1). Les cartes de circuits gardent les visuels dessinés.
- **Journal d'Auth.js** : le site public lit la session à chaque page ; un cookie de session illisible (chiffré avec un autre `AUTH_SECRET`, par exemple celui d'une autre application sur `localhost`, les cookies ne distinguant pas les ports) produisait une longue trace `JWTSessionError`. Auth.js l'ignore déjà (visiteur non connecté) : le journal n'affiche plus qu'un avertissement d'une ligne. Correction liée : le filtre lit `error.type` et non `error.name`, que le build de production minifie (« z ») ; vérifié sur le serveur de production avec un faux cookie et un mauvais mot de passe.
- **À signaler** : les descriptions saisies dans le seed (mentions `TODO(données terrain)`, attributions OpenStreetMap des lieux) s'affichent telles quelles sur le site public. C'est volontaire (rien n'est masqué ni inventé) ; les textes définitifs de Green Trek les remplaceront.
- **Tests** : 16 tests d'intégration (agence suspendue ou inconnue, brouillon et archivé invisibles, isolation entre agences par slug et par identifiant, absence des champs internes, départs complets, annulés, commencés ou de circuit dépublié non proposés, places libres, prix « à partir de », ordre des prochains départs, recherche par chaque critère et combinée, paramètres d'URL invalides, partenaires actifs seulement) et un test unitaire de la date (« 1er novembre »).
- **Parcours dans le navigateur** (serveur de production, visiteur non connecté) : accueil, liste, recherche par voyageurs, par difficulté et date, depuis le formulaire, paramètres invalides, détail avec tracé, page de réservation ; 404 pour un circuit d'une autre agence, une agence inconnue et un départ d'une autre agence ; ordinateur et mobile sans débordement ; aucune erreur.

### E8b — Accueil du site vitrine d'après la maquette (2026-09-29)

- **Structure de la maquette (§8.4)** : hero photo avec bord « coup de pinceau » et badge sable ; barre de recherche flottante ; carrousel des circuits ; « Vivre Madagascar autrement » (trois pictogrammes Randonnée, Pirogue, Immersion au village, collage de photos rondes) ; « Le meilleur pour votre aventure » (grande photo, carte teal sombre, six tuiles : Guide local, Hébergement, Repas ruraux, Pirogue, Sécurité, Petits groupes) ; quatre tuiles photo (Sentiers, Rivière et pirogue, Plages, Actions écologiques) ; carrousel des prochains départs ; partenaires ; pied de page. Textes génériques tirés du cahier des charges, sans chiffre ni fait inventé. Pas de galerie « Suivez-nous » ni d'avis (décisions B et C).
- **Interactions (§8.5)** : en-tête qui se réduit au défilement (petit composant client, l'en-tête reste normal sans JavaScript) ; carrousels à défilement natif avec accrochage (glisser au doigt, clavier) et flèches désactivées aux extrémités ; survol des cartes et tuiles ; animations coupées si `prefers-reduced-motion`. Bord « coup de pinceau » : contour SVG calculé de façon déterministe (même rendu partout).
- **Photos fournies par l'étudiant** (5 photos en plus de celle du hero), redimensionnées (1 600 à 2 400 px) dans `public/images/` et servies optimisées par `next/image`. Textes alternatifs descriptifs sans nom de lieu : aucune photo n'est présentée comme prise à Madagascar. `TODO(photos Green Trek)` : confirmer la source et la licence de chaque photo (§8.1) ; remplacer à terme par des photos de la région de Mahambo (en particulier la forêt de feuillus des « Actions écologiques », visiblement non tropicale). Les cartes de circuits gardent les visuels dessinés : la photo d'un circuit se renseigne dans sa fiche (« Image principale »).
- **Typographie (écart au §8.3, décision de l'étudiant)** : Nohemi pour les titres de toute l'application (site public, back-office, connexion), Poppins pour le texte ; la police manuscrite indicative (Kaushan Script) est retirée. Nohemi n'est pas sur Google Fonts : fichiers locaux dans `src/fonts/` chargés par `next/font/local` (servis par l'application, donc disponibles hors ligne). Licence : fichier `src/fonts/Nohemi-LICENCE.txt` (« Commercial Use Allowed », téléchargée sur Befonts) ; à confirmer auprès de l'auteur (Pangram Pangram), le site de téléchargement n'étant pas l'éditeur.
- **Vérifications** : parcours complet du site public inchangé et sans erreur ; accueil sur ordinateur et mobile avec défilement complet : toutes les images chargées, aucun débordement, en-tête réduit après défilement, flèche « Suivant » du carrousel fonctionnelle ; back-office et page de connexion vérifiés avec les nouvelles polices.

### E8c — Photos des circuits et des partenaires, finitions visuelles (2026-09-29, demandes de l'étudiant)

- **Photos des circuits** : au lieu d'images trouvées sur Google (généralement protégées par le droit d'auteur), 10 photos réelles de Madagascar sous licence libre, choisies sur Wikimedia Commons via son API (auteur et licence relevés automatiquement), téléchargées en 1 600 px dans `public/images/circuits/` (disponibles hors ligne). Pour Green Trek : coucher de soleil sur la plage de Mahambo (NalyRATOVO, CC BY-SA 4.0), pirogue aux environs de Toamasina (CC0), habitation traditionnelle du canal des Pangalanes (CC BY-SA 4.0), caméléon panthère photographié à Mahambo (Bernard Dupont, CC BY-SA 2.0 ; sa description indique « Mahambo »). Agences fictives : rizières des Hautes Terres, lac Tritriva, Andasibe-Mantadia, Isalo, Pangalanes à Mananjary, orchidée d'Analamazaotra. Enregistrées dans `imagePrincipaleUrl` (seed et base de dev mise à jour sans relancer le seed).
- **Attribution obligatoire (CC BY / BY-SA)** : registre `src/lib/photo-credits.ts` (sujet, auteur, licence, lien de licence, source) ; crédit affiché sous la photo de chaque circuit et page « Crédits photos » (`/a/[slug]/credits-photos`, lien dans le pied de page). Test unitaire : chaque photo de `public/images/` est créditée ou déclarée, chaque photo de circuit a un crédit complet.
- **Photos des partenaires** (fournies par l'étudiant : pêcheur en pirogue, bâtiment d'hébergement, surfeuse, enseigne du Vanilla Café) sur des cartes illustrées. **Écart au §5.2** : ajout du champ facultatif `Partenaire.imageUrl` (migration `partenaire_image_url`), saisissable dans le formulaire du back-office. `TODO(photos Green Trek)` : source et licence à confirmer (photos présentées sans nommer de lieu, sauf l'enseigne du Vanilla Café).
- **Champ image** : une image est soit une adresse web (http/https), soit une image livrée avec l'application (`/images/…`, extensions jpg/png/webp/avif, sans `..`) ; les autres chemins et protocoles sont refusés (tests). Les photos locales sont servies optimisées par `next/image`.
- **Titre du hero en police script** (Dancing Script, Google Fonts via `next/font`, donc hors ligne) : uniquement le grand titre du hero ; Nohemi reste la police des titres, Poppins celle du texte. Correction liée : la règle des titres Nohemi est placée dans la couche CSS `base`, sinon elle l'emportait sur toutes les classes utilitaires.
- **Cercles flous décoratifs** (`BlurBlobs`) : halos très diffus aux couleurs de la palette derrière les sections de l'accueil, la liste et la fiche des circuits, la page des crédits ; purement décoratifs (`aria-hidden`, aucun clic intercepté) ; le `<main>` coupe le débordement horizontal (`overflow-x-clip`).
- **Vérifications** : parcours complet du site public sans erreur ; accueil sur ordinateur et mobile sans débordement ; toutes les images chargées (sur mobile, les cartes hors écran des carrousels se chargent quand on les fait défiler, chargement différé normal) ; crédit visible sur la fiche d'un circuit ; page des crédits (20 photos).

## Captures d'écran à prendre

- E8c : accueil avec les photos réelles des circuits et les partenaires illustrés ; fiche d'un circuit avec la photo de Mahambo et son crédit ; page « Crédits photos ».

- E8b : accueil complet du site vitrine (ordinateur et mobile) ; comparaison avec la maquette d'inspiration section par section ; en-tête réduit au défilement ; carrousel des circuits.

- E8a : accueil du site vitrine (ordinateur et mobile) ; résultats d'une recherche ; message « aucun départ ne correspond » ; détail d'un circuit (carte avec tracé, étapes par jour, départs) ; page 404 d'un circuit d'une autre agence.

- E0 : page d'accueil provisoire (palette) et réponse JSON de `/api/health` avec `"database": "connectée"`.
- E1 : ERD exporté depuis mermaid.live ou MySQL Workbench ; résultat de `npm test` (tests d'intégration des contraintes).
- E2a : sortie de `npm test` montrant les tests d'isolation (liste détaillée : `npx vitest run tests/integration/isolation.test.ts`).
- E3a : back-office sur ordinateur et sur mobile (menu ouvert) ; liste de l'équipe ; refus « dernier administrateur » ; page Mon profil.
- E3b : paramètres de l'agence ; liste des partenaires (les 4 partenaires réels de Green Trek) ; fiche d'un guide avec ses langues ; refus de suppression d'un partenaire utilisé (après E4).
- E7 : liste des départs groupée par mois (ordinateur et mobile) ; formulaire « Programmer un départ » avec la date de fin proposée ; refus « capacité du circuit » ; fiche d'un départ (remplissage, réservations, participants) ; confirmation d'annulation ; vue « Mes départs » du guide ; section « Prochains départs » d'une fiche circuit.
- E6 : comparaison Dijkstra / A* (tableau et nœuds explorés de chacun sur la carte) ; message « aucun chemin » vers Sainte-Marie ; étapes imposées en ordre libre ; historique des calculs ; page Performances (graphiques et tableau) ; tracé réel d'un circuit ; sortie de `npx vitest run tests/unit/graph`.
- E5 : vue Tronçons (réseau en pointillés, légende) ; création d'un tronçon (départ rouge, arrivée orange, distance proposée) ; refus d'un doublon ; fiche d'un lieu avec ses tronçons ; Sainte-Marie non reliée.
- E4 bis : carte plein cadre (côte Est, 27 lieux réels), fiche d'un lieu avec vue satellite, calque Satellite, filtre « Embarcadères », version mobile.
- E4 : carte des étapes (lieux OpenStreetMap autour de Mahambo) ; formulaire « Nouvelle étape » après un clic ; fiche d'un circuit avec l'itinéraire numéroté sur la carte ; liste des circuits ; refus de publication sous deux étapes.
- Refonte : tableau de bord de l'agence (ordinateur et mobile), vue plateforme du super admin, espace voyageur, tableau de bord du guide ; comparaison avec la maquette d'inspiration.
- E2b : page `/connexion` ; formulaire `/inscription-agence` avec erreurs de validation ; `/dashboard` après inscription d'une nouvelle agence ; `/admin` (super admin) ; message d'erreur après une connexion refusée.

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
