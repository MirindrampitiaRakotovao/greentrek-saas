# Suivi d'avancement

Fichier tenu à jour par Claude Code à chaque étape. Il alimente le mémoire : ne jamais marquer « fait » ce qui n'est pas testé.

## État des étapes

| Étape | Statut | Date | Remarques |
|---|---|---|---|
| E0 Initialisation | Fait | 2026-09-28 | Typecheck, lint, test et build verts ; base MySQL créée ; `/api/health` renvoie 200 « connectée » (vérifié chez l'étudiant) |
| E1 Schéma Prisma | Fait | 2026-09-28 | 19 tables et 18 CHECK migrés, seed OK, ERD rédigé ; typecheck, lint et build verts ; `npm test` 23/23 (3 unitaires, 20 d'intégration) chez l'étudiant |
| E2 Auth et multi-tenant | Fait | 2026-09-28 | Typecheck, lint, 167 tests, build et 14 scénarios de bout en bout verts ; parcours vérifiés dans le navigateur par l'étudiant (connexion admin, inscription d'agence, connexion client, super admin) |
| E3 Fondations back-office | Fait | 2026-09-28 | Validé par l'étudiant. Complété par la refonte visuelle des tableaux de bord (voir « Refonte des tableaux de bord ») |
| E4 Circuits et étapes | En cours | 2026-09-29 | Typecheck, lint, 297 tests, build et contrôles dans le navigateur (carte, clic, lecture seule du guide, mobile) verts ; en attente de vérification par l'étudiant |
| E5 Éditeur de graphe | À faire | | |
| E6 Algorithmes | À faire | | |
| E7 Départs | À faire | | |
| E8 Site vitrine | À faire | | |
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

## Captures d'écran à prendre

- E0 : page d'accueil provisoire (palette) et réponse JSON de `/api/health` avec `"database": "connectée"`.
- E1 : ERD exporté depuis mermaid.live ou MySQL Workbench ; résultat de `npm test` (tests d'intégration des contraintes).
- E2a : sortie de `npm test` montrant les tests d'isolation (liste détaillée : `npx vitest run tests/integration/isolation.test.ts`).
- E3a : back-office sur ordinateur et sur mobile (menu ouvert) ; liste de l'équipe ; refus « dernier administrateur » ; page Mon profil.
- E3b : paramètres de l'agence ; liste des partenaires (les 4 partenaires réels de Green Trek) ; fiche d'un guide avec ses langues ; refus de suppression d'un partenaire utilisé (après E4).
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
