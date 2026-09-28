# Modèle entité-association (ERD) — Green Trek SaaS

Reflet fidèle de `prisma/schema.prisma` (migration `init`, étape E1) : 19 tables. Seuls les clés et les champs structurants sont affichés ; le détail complet est dans le schéma Prisma.

Notation : `PK` clé primaire, `FK` clé étrangère, `UK` unique. Les identifiants sont des `cuid` (texte).

**Exporter en image pour le mémoire :**
- copier le bloc `mermaid` ci-dessous dans <https://mermaid.live>, puis *Actions → PNG/SVG* ;
- ou, pour un diagramme physique complet (types, index), MySQL Workbench : *Database → Reverse Engineer…* sur la base `greentrek`.

```mermaid
erDiagram
  AGENCE ||--o{ UTILISATEUR : "compte"
  AGENCE ||--o{ ABONNEMENT : "souscrit"
  PLAN ||--o{ ABONNEMENT : "definit"
  AGENCE ||--o{ GUIDE : "emploie"
  UTILISATEUR |o--o| GUIDE : "compte de"
  AGENCE ||--o{ CIRCUIT : "propose"
  AGENCE ||--o{ ETAPE : "possede"
  AGENCE ||--o{ TRONCON : "possede"
  AGENCE ||--o{ PARTENAIRE : "reference"
  ETAPE ||--o{ TRONCON : "depart"
  ETAPE ||--o{ TRONCON : "arrivee"
  CIRCUIT ||--o{ CIRCUIT_ETAPE : "contient"
  ETAPE ||--o{ CIRCUIT_ETAPE : "utilisee dans"
  CIRCUIT ||--o{ CIRCUIT_PARTENAIRE : "inclut"
  PARTENAIRE ||--o{ CIRCUIT_PARTENAIRE : "intervient"
  ETAPE |o--o{ CIRCUIT_PARTENAIRE : "lieu"
  AGENCE ||--o{ SESSION_DEPART : "programme"
  CIRCUIT ||--o{ SESSION_DEPART : "programme"
  GUIDE |o--o{ SESSION_DEPART : "encadre"
  AGENCE ||--o{ RESERVATION : "enregistre"
  UTILISATEUR ||--o{ RESERVATION : "effectue"
  SESSION_DEPART ||--o{ RESERVATION : "recoit"
  RESERVATION ||--o{ PARTICIPANT : "comprend"
  RESERVATION ||--o{ PAIEMENT : "reglee par"
  RESERVATION ||--o| AVIS : "donne lieu"
  CIRCUIT ||--o{ AVIS : "evalue"
  UTILISATEUR ||--o{ AVIS : "redige"
  AGENCE ||--o{ AVIS : "modere"
  UTILISATEUR ||--o{ NOTIFICATION : "recoit"
  AGENCE |o--o{ NOTIFICATION : "emet"
  UTILISATEUR |o--o{ JOURNAL_ACTIVITE : "genere"
  AGENCE |o--o{ JOURNAL_ACTIVITE : "trace"
  AGENCE ||--o{ ITINERAIRE_CALCULE : "conserve"
  CIRCUIT |o--o{ ITINERAIRE_CALCULE : "concerne"
  ETAPE |o--o{ ITINERAIRE_CALCULE : "depart"
  ETAPE |o--o{ ITINERAIRE_CALCULE : "arrivee"
  UTILISATEUR |o--o{ ITINERAIRE_CALCULE : "calcule"

  AGENCE {
    string id PK
    string slug UK
    string nom
    string devise
    enum statut "ACTIVE, SUSPENDUE"
  }
  UTILISATEUR {
    string id PK
    string agenceId FK "null si SUPER_ADMIN"
    string email "UK avec agenceId"
    string motDePasseHash
    enum role
    boolean actif
  }
  PLAN {
    string id PK
    string code UK
    int prixMensuel
    int maxCircuits
    int maxUtilisateurs
    int maxSessionsActives
  }
  ABONNEMENT {
    string id PK
    string agenceId FK
    string planId FK
    date dateDebut
    date dateFin
    enum statut
  }
  GUIDE {
    string id PK
    string agenceId FK
    string utilisateurId FK "UK, nullable"
    json langues
  }
  CIRCUIT {
    string id PK
    string agenceId FK
    string slug "UK avec agenceId"
    enum difficulte
    int dureeJours
    int prixParPersonne
    int capaciteMax
    enum statut
  }
  ETAPE {
    string id PK
    string agenceId FK
    string nom
    enum type
    float latitude
    float longitude
  }
  TRONCON {
    string id PK
    string agenceId FK
    string etapeDepartId FK "UK avec etapeArriveeId"
    string etapeArriveeId FK
    float distanceKm "> 0"
    int dureeMinutes "> 0"
    int difficulte "1 a 5"
    boolean bidirectionnel
    boolean distanceEstimee
  }
  CIRCUIT_ETAPE {
    string id PK
    string circuitId FK "UK avec ordre"
    string etapeId FK
    int ordre ">= 1"
    int jour
  }
  PARTENAIRE {
    string id PK
    string agenceId FK
    string nom
    enum type
  }
  CIRCUIT_PARTENAIRE {
    string id PK
    string circuitId FK
    string partenaireId FK
    string etapeId FK "nullable"
    string prestation
  }
  SESSION_DEPART {
    string id PK
    string agenceId FK
    string circuitId FK
    string guideId FK "nullable"
    date dateDebut
    date dateFin ">= dateDebut"
    int placesTotal "> 0"
    enum statut
  }
  RESERVATION {
    string id PK
    string agenceId FK
    string reference UK
    string clientId FK
    string sessionId FK
    int nombrePersonnes "> 0"
    int montantTotal "fige"
    enum statut
  }
  PARTICIPANT {
    string id PK
    string reservationId FK
    string nom
    string prenom
  }
  PAIEMENT {
    string id PK
    string reservationId FK
    int montant "> 0"
    enum methode
    enum statut
  }
  AVIS {
    string id PK
    string agenceId FK
    string circuitId FK
    string reservationId FK "UK"
    string clientId FK
    int note "1 a 5"
  }
  NOTIFICATION {
    string id PK
    string agenceId FK "nullable"
    string utilisateurId FK
    boolean lue
  }
  JOURNAL_ACTIVITE {
    string id PK
    string agenceId FK "nullable"
    string utilisateurId FK "nullable"
    string action
    json details
  }
  ITINERAIRE_CALCULE {
    string id PK
    string agenceId FK
    string etapeDepartId FK "nullable"
    string etapeArriveeId FK "nullable"
    enum algorithme
    json cheminJson
    int noeudsExplores
    float tempsCalculMs
  }
```

## Écarts avec le cahier des charges §5.2 (à reporter dans le mémoire)

| Élément | Cahier des charges | Implémenté | Justification |
|---|---|---|---|
| `Circuit.difficulte` | type non précisé | enum `FACILE` / `MOYENNE` / `DIFFICILE` | Filtre de recherche simple côté vitrine ; la difficulté fine (1 à 5) reste sur les tronçons |
| `ItineraireCalcule.etapeDepartId` / `etapeArriveeId` | obligatoires | nullables (`SET NULL`) | L'historique est un instantané (`cheminJson`) : il ne doit pas empêcher la suppression d'une étape |
| `ItineraireCalcule.difficulteCumulee` | absent de la table | ajouté | Sortie exigée au §6.3 |
| `ItineraireCalcule.creePar` | `creePar` | `creeParId` (clé étrangère vers `Utilisateur`) | Convention de nommage des clés étrangères |
| `CircuitPartenaire.etapeId` | nullable | nullable, suppression de l'étape refusée | Cohérence avec RG 8 |

## Règles de gestion garanties par la base

| Règle | Mécanisme |
|---|---|
| RG 1 slug d'agence unique | index unique `Agence.slug` |
| RG 3 e-mail unique dans une agence | index unique `(agenceId, email)` |
| RG 4 rang sans doublon | index unique `(circuitId, ordre)` + CHECK `ordre >= 1` |
| RG 6 étapes distinctes, distance > 0 | CHECK `Troncon_etapes_distinctes_check`, `Troncon_distanceKm_check` |
| RG 7 un tronçon par couple | index unique `(etapeDepartId, etapeArriveeId)` |
| RG 8 étape utilisée non supprimable | clés étrangères `ON DELETE RESTRICT` (Troncon, CircuitEtape, CircuitPartenaire) |
| RG 10 fin ≥ début | CHECK `SessionDepart_dates_check` |
| RG 12 au moins une personne | CHECK `Reservation_nombrePersonnes_check` |
| RG 17 un avis par réservation | index unique `Avis.reservationId` |

Les autres règles (RG 2, 5, 6 « même agence », 9, 11, 13 à 16, 17 « réservation terminée », 18 à 20) relèvent de l'application : helper tenant, transactions, validations Zod.
