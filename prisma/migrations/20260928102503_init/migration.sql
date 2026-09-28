-- CreateTable
CREATE TABLE `Agence` (
    `id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `logoUrl` VARCHAR(500) NULL,
    `couleurPrimaire` VARCHAR(7) NULL,
    `email` VARCHAR(191) NULL,
    `telephone` VARCHAR(30) NULL,
    `adresse` VARCHAR(255) NULL,
    `ville` VARCHAR(100) NULL,
    `pays` VARCHAR(100) NULL,
    `devise` VARCHAR(3) NOT NULL DEFAULT 'MGA',
    `statut` ENUM('ACTIVE', 'SUSPENDUE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Agence_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Utilisateur` (
    `id` VARCHAR(191) NOT NULL,
    `agenceId` VARCHAR(191) NULL,
    `nom` VARCHAR(100) NOT NULL,
    `prenom` VARCHAR(100) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `motDePasseHash` VARCHAR(255) NOT NULL,
    `telephone` VARCHAR(30) NULL,
    `role` ENUM('SUPER_ADMIN', 'ADMIN_AGENCE', 'STAFF', 'GUIDE', 'CLIENT') NOT NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `dernierLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Utilisateur_email_idx`(`email`),
    UNIQUE INDEX `Utilisateur_agenceId_email_key`(`agenceId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Circuit` (
    `id` VARCHAR(191) NOT NULL,
    `agenceId` VARCHAR(191) NOT NULL,
    `titre` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(200) NOT NULL,
    `resume` VARCHAR(500) NULL,
    `description` TEXT NULL,
    `difficulte` ENUM('FACILE', 'MOYENNE', 'DIFFICILE') NOT NULL,
    `dureeJours` INTEGER NOT NULL,
    `distanceKm` DOUBLE NULL,
    `prixParPersonne` INTEGER NOT NULL,
    `capaciteMax` INTEGER NOT NULL,
    `imagePrincipaleUrl` VARCHAR(500) NULL,
    `statut` ENUM('BROUILLON', 'PUBLIE', 'ARCHIVE') NOT NULL DEFAULT 'BROUILLON',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Circuit_agenceId_statut_idx`(`agenceId`, `statut`),
    UNIQUE INDEX `Circuit_agenceId_slug_key`(`agenceId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Etape` (
    `id` VARCHAR(191) NOT NULL,
    `agenceId` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `type` ENUM('VILLAGE', 'POINT_INTERET', 'HEBERGEMENT', 'RESTAURATION', 'EMBARCADERE', 'AUTRE') NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `altitudeM` INTEGER NULL,

    INDEX `Etape_agenceId_idx`(`agenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Troncon` (
    `id` VARCHAR(191) NOT NULL,
    `agenceId` VARCHAR(191) NOT NULL,
    `etapeDepartId` VARCHAR(191) NOT NULL,
    `etapeArriveeId` VARCHAR(191) NOT NULL,
    `distanceKm` DOUBLE NOT NULL,
    `dureeMinutes` INTEGER NOT NULL,
    `deniveleM` INTEGER NULL,
    `difficulte` INTEGER NOT NULL,
    `bidirectionnel` BOOLEAN NOT NULL DEFAULT true,
    `distanceEstimee` BOOLEAN NOT NULL DEFAULT false,
    `commentaire` TEXT NULL,

    INDEX `Troncon_agenceId_idx`(`agenceId`),
    INDEX `Troncon_etapeArriveeId_idx`(`etapeArriveeId`),
    UNIQUE INDEX `Troncon_etapeDepartId_etapeArriveeId_key`(`etapeDepartId`, `etapeArriveeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CircuitEtape` (
    `id` VARCHAR(191) NOT NULL,
    `circuitId` VARCHAR(191) NOT NULL,
    `etapeId` VARCHAR(191) NOT NULL,
    `ordre` INTEGER NOT NULL,
    `jour` INTEGER NULL,
    `dureeSejourMin` INTEGER NULL,
    `notes` TEXT NULL,

    INDEX `CircuitEtape_etapeId_idx`(`etapeId`),
    UNIQUE INDEX `CircuitEtape_circuitId_ordre_key`(`circuitId`, `ordre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SessionDepart` (
    `id` VARCHAR(191) NOT NULL,
    `agenceId` VARCHAR(191) NOT NULL,
    `circuitId` VARCHAR(191) NOT NULL,
    `guideId` VARCHAR(191) NULL,
    `dateDebut` DATE NOT NULL,
    `dateFin` DATE NOT NULL,
    `placesTotal` INTEGER NOT NULL,
    `prixParPersonne` INTEGER NULL,
    `statut` ENUM('OUVERTE', 'COMPLETE', 'ANNULEE', 'TERMINEE') NOT NULL DEFAULT 'OUVERTE',
    `notes` TEXT NULL,

    INDEX `SessionDepart_agenceId_dateDebut_idx`(`agenceId`, `dateDebut`),
    INDEX `SessionDepart_circuitId_idx`(`circuitId`),
    INDEX `SessionDepart_guideId_idx`(`guideId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reservation` (
    `id` VARCHAR(191) NOT NULL,
    `agenceId` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(20) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `nombrePersonnes` INTEGER NOT NULL,
    `montantTotal` INTEGER NOT NULL,
    `statut` ENUM('EN_ATTENTE', 'CONFIRMEE', 'ANNULEE', 'TERMINEE') NOT NULL DEFAULT 'EN_ATTENTE',
    `remarques` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confirmeeAt` DATETIME(3) NULL,
    `annuleeAt` DATETIME(3) NULL,

    UNIQUE INDEX `Reservation_reference_key`(`reference`),
    INDEX `Reservation_agenceId_statut_idx`(`agenceId`, `statut`),
    INDEX `Reservation_clientId_idx`(`clientId`),
    INDEX `Reservation_sessionId_idx`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Guide` (
    `id` VARCHAR(191) NOT NULL,
    `agenceId` VARCHAR(191) NOT NULL,
    `utilisateurId` VARCHAR(191) NULL,
    `nom` VARCHAR(100) NOT NULL,
    `prenom` VARCHAR(100) NOT NULL,
    `telephone` VARCHAR(30) NULL,
    `bio` TEXT NULL,
    `langues` JSON NOT NULL,
    `experienceAnnees` INTEGER NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Guide_utilisateurId_key`(`utilisateurId`),
    INDEX `Guide_agenceId_idx`(`agenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Partenaire` (
    `id` VARCHAR(191) NOT NULL,
    `agenceId` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(150) NOT NULL,
    `type` ENUM('HEBERGEMENT', 'RESTAURATION', 'ACTIVITE', 'TRANSPORT') NOT NULL,
    `description` TEXT NULL,
    `telephone` VARCHAR(30) NULL,
    `email` VARCHAR(191) NULL,
    `adresse` VARCHAR(255) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `tarifIndicatif` INTEGER NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,

    INDEX `Partenaire_agenceId_idx`(`agenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CircuitPartenaire` (
    `id` VARCHAR(191) NOT NULL,
    `circuitId` VARCHAR(191) NOT NULL,
    `partenaireId` VARCHAR(191) NOT NULL,
    `etapeId` VARCHAR(191) NULL,
    `prestation` VARCHAR(200) NOT NULL,
    `prixUnitaire` INTEGER NULL,
    `inclusDansPrix` BOOLEAN NOT NULL DEFAULT true,

    INDEX `CircuitPartenaire_circuitId_idx`(`circuitId`),
    INDEX `CircuitPartenaire_partenaireId_idx`(`partenaireId`),
    INDEX `CircuitPartenaire_etapeId_idx`(`etapeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Participant` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(100) NOT NULL,
    `prenom` VARCHAR(100) NOT NULL,
    `age` INTEGER NULL,
    `nationalite` VARCHAR(100) NULL,
    `contactUrgence` VARCHAR(191) NULL,

    INDEX `Participant_reservationId_idx`(`reservationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Paiement` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `montant` INTEGER NOT NULL,
    `methode` ENUM('ESPECES', 'MOBILE_MONEY', 'VIREMENT', 'CARTE_SIMULEE') NOT NULL,
    `statut` ENUM('EN_ATTENTE', 'VALIDE', 'ECHOUE', 'REMBOURSE') NOT NULL DEFAULT 'EN_ATTENTE',
    `referenceExterne` VARCHAR(100) NULL,
    `payeLe` DATETIME(3) NULL,

    INDEX `Paiement_reservationId_idx`(`reservationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItineraireCalcule` (
    `id` VARCHAR(191) NOT NULL,
    `agenceId` VARCHAR(191) NOT NULL,
    `circuitId` VARCHAR(191) NULL,
    `etapeDepartId` VARCHAR(191) NULL,
    `etapeArriveeId` VARCHAR(191) NULL,
    `algorithme` ENUM('DIJKSTRA', 'ASTAR') NOT NULL,
    `critere` ENUM('PLUS_COURT', 'PLUS_RAPIDE', 'PLUS_FACILE', 'PERSONNALISE') NOT NULL,
    `alpha` DOUBLE NOT NULL,
    `beta` DOUBLE NOT NULL,
    `gamma` DOUBLE NOT NULL,
    `cheminJson` JSON NOT NULL,
    `distanceTotaleKm` DOUBLE NOT NULL,
    `dureeTotaleMin` INTEGER NOT NULL,
    `difficulteCumulee` DOUBLE NOT NULL,
    `noeudsExplores` INTEGER NOT NULL,
    `tempsCalculMs` DOUBLE NOT NULL,
    `creeParId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ItineraireCalcule_agenceId_createdAt_idx`(`agenceId`, `createdAt`),
    INDEX `ItineraireCalcule_circuitId_idx`(`circuitId`),
    INDEX `ItineraireCalcule_etapeDepartId_idx`(`etapeDepartId`),
    INDEX `ItineraireCalcule_etapeArriveeId_idx`(`etapeArriveeId`),
    INDEX `ItineraireCalcule_creeParId_idx`(`creeParId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Plan` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `nom` VARCHAR(100) NOT NULL,
    `prixMensuel` INTEGER NOT NULL,
    `maxCircuits` INTEGER NOT NULL,
    `maxUtilisateurs` INTEGER NOT NULL,
    `maxSessionsActives` INTEGER NOT NULL,
    `fonctionnalites` JSON NOT NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Plan_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Abonnement` (
    `id` VARCHAR(191) NOT NULL,
    `agenceId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `dateDebut` DATE NOT NULL,
    `dateFin` DATE NULL,
    `statut` ENUM('ESSAI', 'ACTIF', 'EXPIRE', 'ANNULE') NOT NULL,
    `renouvellementAuto` BOOLEAN NOT NULL DEFAULT false,

    INDEX `Abonnement_agenceId_idx`(`agenceId`),
    INDEX `Abonnement_planId_idx`(`planId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Avis` (
    `id` VARCHAR(191) NOT NULL,
    `agenceId` VARCHAR(191) NOT NULL,
    `circuitId` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `note` INTEGER NOT NULL,
    `commentaire` TEXT NULL,
    `statut` ENUM('EN_ATTENTE', 'PUBLIE', 'REJETE') NOT NULL DEFAULT 'EN_ATTENTE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Avis_reservationId_key`(`reservationId`),
    INDEX `Avis_agenceId_statut_idx`(`agenceId`, `statut`),
    INDEX `Avis_circuitId_idx`(`circuitId`),
    INDEX `Avis_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `agenceId` VARCHAR(191) NULL,
    `utilisateurId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `titre` VARCHAR(200) NOT NULL,
    `message` TEXT NOT NULL,
    `lienUrl` VARCHAR(500) NULL,
    `lue` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_agenceId_idx`(`agenceId`),
    INDEX `Notification_utilisateurId_lue_idx`(`utilisateurId`, `lue`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalActivite` (
    `id` VARCHAR(191) NOT NULL,
    `agenceId` VARCHAR(191) NULL,
    `utilisateurId` VARCHAR(191) NULL,
    `action` VARCHAR(100) NOT NULL,
    `entite` VARCHAR(50) NOT NULL,
    `entiteId` VARCHAR(30) NULL,
    `details` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `JournalActivite_agenceId_createdAt_idx`(`agenceId`, `createdAt`),
    INDEX `JournalActivite_utilisateurId_idx`(`utilisateurId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Utilisateur` ADD CONSTRAINT `Utilisateur_agenceId_fkey` FOREIGN KEY (`agenceId`) REFERENCES `Agence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Circuit` ADD CONSTRAINT `Circuit_agenceId_fkey` FOREIGN KEY (`agenceId`) REFERENCES `Agence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Etape` ADD CONSTRAINT `Etape_agenceId_fkey` FOREIGN KEY (`agenceId`) REFERENCES `Agence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Troncon` ADD CONSTRAINT `Troncon_agenceId_fkey` FOREIGN KEY (`agenceId`) REFERENCES `Agence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Troncon` ADD CONSTRAINT `Troncon_etapeDepartId_fkey` FOREIGN KEY (`etapeDepartId`) REFERENCES `Etape`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Troncon` ADD CONSTRAINT `Troncon_etapeArriveeId_fkey` FOREIGN KEY (`etapeArriveeId`) REFERENCES `Etape`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `CircuitEtape` ADD CONSTRAINT `CircuitEtape_circuitId_fkey` FOREIGN KEY (`circuitId`) REFERENCES `Circuit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CircuitEtape` ADD CONSTRAINT `CircuitEtape_etapeId_fkey` FOREIGN KEY (`etapeId`) REFERENCES `Etape`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionDepart` ADD CONSTRAINT `SessionDepart_agenceId_fkey` FOREIGN KEY (`agenceId`) REFERENCES `Agence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionDepart` ADD CONSTRAINT `SessionDepart_circuitId_fkey` FOREIGN KEY (`circuitId`) REFERENCES `Circuit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionDepart` ADD CONSTRAINT `SessionDepart_guideId_fkey` FOREIGN KEY (`guideId`) REFERENCES `Guide`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_agenceId_fkey` FOREIGN KEY (`agenceId`) REFERENCES `Agence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `SessionDepart`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Guide` ADD CONSTRAINT `Guide_agenceId_fkey` FOREIGN KEY (`agenceId`) REFERENCES `Agence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Guide` ADD CONSTRAINT `Guide_utilisateurId_fkey` FOREIGN KEY (`utilisateurId`) REFERENCES `Utilisateur`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Partenaire` ADD CONSTRAINT `Partenaire_agenceId_fkey` FOREIGN KEY (`agenceId`) REFERENCES `Agence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CircuitPartenaire` ADD CONSTRAINT `CircuitPartenaire_circuitId_fkey` FOREIGN KEY (`circuitId`) REFERENCES `Circuit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CircuitPartenaire` ADD CONSTRAINT `CircuitPartenaire_partenaireId_fkey` FOREIGN KEY (`partenaireId`) REFERENCES `Partenaire`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CircuitPartenaire` ADD CONSTRAINT `CircuitPartenaire_etapeId_fkey` FOREIGN KEY (`etapeId`) REFERENCES `Etape`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Participant` ADD CONSTRAINT `Participant_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Paiement` ADD CONSTRAINT `Paiement_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItineraireCalcule` ADD CONSTRAINT `ItineraireCalcule_agenceId_fkey` FOREIGN KEY (`agenceId`) REFERENCES `Agence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItineraireCalcule` ADD CONSTRAINT `ItineraireCalcule_circuitId_fkey` FOREIGN KEY (`circuitId`) REFERENCES `Circuit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItineraireCalcule` ADD CONSTRAINT `ItineraireCalcule_etapeDepartId_fkey` FOREIGN KEY (`etapeDepartId`) REFERENCES `Etape`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItineraireCalcule` ADD CONSTRAINT `ItineraireCalcule_etapeArriveeId_fkey` FOREIGN KEY (`etapeArriveeId`) REFERENCES `Etape`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItineraireCalcule` ADD CONSTRAINT `ItineraireCalcule_creeParId_fkey` FOREIGN KEY (`creeParId`) REFERENCES `Utilisateur`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Abonnement` ADD CONSTRAINT `Abonnement_agenceId_fkey` FOREIGN KEY (`agenceId`) REFERENCES `Agence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Abonnement` ADD CONSTRAINT `Abonnement_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Avis` ADD CONSTRAINT `Avis_agenceId_fkey` FOREIGN KEY (`agenceId`) REFERENCES `Agence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Avis` ADD CONSTRAINT `Avis_circuitId_fkey` FOREIGN KEY (`circuitId`) REFERENCES `Circuit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Avis` ADD CONSTRAINT `Avis_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Avis` ADD CONSTRAINT `Avis_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_agenceId_fkey` FOREIGN KEY (`agenceId`) REFERENCES `Agence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_utilisateurId_fkey` FOREIGN KEY (`utilisateurId`) REFERENCES `Utilisateur`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalActivite` ADD CONSTRAINT `JournalActivite_agenceId_fkey` FOREIGN KEY (`agenceId`) REFERENCES `Agence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalActivite` ADD CONSTRAINT `JournalActivite_utilisateurId_fkey` FOREIGN KEY (`utilisateurId`) REFERENCES `Utilisateur`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Contraintes CHECK (ajoutées à la main, non gérées par Prisma) ─────────────
-- Double défense avec la validation Zod de l'application : même une requête SQL
-- directe ne peut pas enregistrer une donnée qui viole ces règles de gestion.
-- MySQL applique les CHECK depuis la version 8.0.16.

-- Coordonnées géographiques valides
ALTER TABLE `Etape` ADD CONSTRAINT `Etape_latitude_check` CHECK (`latitude` BETWEEN -90 AND 90);
ALTER TABLE `Etape` ADD CONSTRAINT `Etape_longitude_check` CHECK (`longitude` BETWEEN -180 AND 180);

-- RG 6 : deux étapes distinctes, distance strictement positive ; §6.1 : poids > 0
ALTER TABLE `Troncon` ADD CONSTRAINT `Troncon_etapes_distinctes_check` CHECK (`etapeDepartId` <> `etapeArriveeId`);
ALTER TABLE `Troncon` ADD CONSTRAINT `Troncon_distanceKm_check` CHECK (`distanceKm` > 0);
ALTER TABLE `Troncon` ADD CONSTRAINT `Troncon_dureeMinutes_check` CHECK (`dureeMinutes` > 0);
ALTER TABLE `Troncon` ADD CONSTRAINT `Troncon_difficulte_check` CHECK (`difficulte` BETWEEN 1 AND 5);

-- Circuit : durée, prix et capacité cohérents
ALTER TABLE `Circuit` ADD CONSTRAINT `Circuit_dureeJours_check` CHECK (`dureeJours` > 0);
ALTER TABLE `Circuit` ADD CONSTRAINT `Circuit_prixParPersonne_check` CHECK (`prixParPersonne` >= 0);
ALTER TABLE `Circuit` ADD CONSTRAINT `Circuit_capaciteMax_check` CHECK (`capaciteMax` > 0);

-- RG 4 : rang d'une étape dans un circuit à partir de 1
ALTER TABLE `CircuitEtape` ADD CONSTRAINT `CircuitEtape_ordre_check` CHECK (`ordre` >= 1);

-- RG 10 : fin ≥ début ; places > 0 ; prix spécifique ≥ 0
ALTER TABLE `SessionDepart` ADD CONSTRAINT `SessionDepart_dates_check` CHECK (`dateFin` >= `dateDebut`);
ALTER TABLE `SessionDepart` ADD CONSTRAINT `SessionDepart_placesTotal_check` CHECK (`placesTotal` > 0);
ALTER TABLE `SessionDepart` ADD CONSTRAINT `SessionDepart_prixParPersonne_check` CHECK (`prixParPersonne` IS NULL OR `prixParPersonne` >= 0);

-- RG 12 : au moins une personne ; montant ≥ 0
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_nombrePersonnes_check` CHECK (`nombrePersonnes` > 0);
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_montantTotal_check` CHECK (`montantTotal` >= 0);

-- Paiement : montant strictement positif (RG 16, plafond vérifié par l'application)
ALTER TABLE `Paiement` ADD CONSTRAINT `Paiement_montant_check` CHECK (`montant` > 0);

-- Avis : note de 1 à 5
ALTER TABLE `Avis` ADD CONSTRAINT `Avis_note_check` CHECK (`note` BETWEEN 1 AND 5);

-- Plan : limites positives
ALTER TABLE `Plan` ADD CONSTRAINT `Plan_limites_check` CHECK (`prixMensuel` >= 0 AND `maxCircuits` > 0 AND `maxUtilisateurs` > 0 AND `maxSessionsActives` > 0);
