-- CreateTable
CREATE TABLE `ItinerairePersonnalise` (
    `id` VARCHAR(191) NOT NULL,
    `agenceId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `creeParId` VARCHAR(191) NOT NULL,
    `itineraireCalculeId` VARCHAR(191) NOT NULL,
    `origine` ENUM('AGENCE', 'CLIENT') NOT NULL,
    `titre` VARCHAR(150) NOT NULL,
    `message` TEXT NULL,
    `statut` ENUM('EN_ATTENTE', 'ACCEPTE', 'DECLINE') NOT NULL DEFAULT 'EN_ATTENTE',
    `reponse` TEXT NULL,
    `reponduAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ItinerairePersonnalise_agenceId_createdAt_idx`(`agenceId`, `createdAt`),
    INDEX `ItinerairePersonnalise_clientId_idx`(`clientId`),
    INDEX `ItinerairePersonnalise_creeParId_idx`(`creeParId`),
    INDEX `ItinerairePersonnalise_itineraireCalculeId_idx`(`itineraireCalculeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ItinerairePersonnalise` ADD CONSTRAINT `ItinerairePersonnalise_agenceId_fkey` FOREIGN KEY (`agenceId`) REFERENCES `Agence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItinerairePersonnalise` ADD CONSTRAINT `ItinerairePersonnalise_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItinerairePersonnalise` ADD CONSTRAINT `ItinerairePersonnalise_creeParId_fkey` FOREIGN KEY (`creeParId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItinerairePersonnalise` ADD CONSTRAINT `ItinerairePersonnalise_itineraireCalculeId_fkey` FOREIGN KEY (`itineraireCalculeId`) REFERENCES `ItineraireCalcule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
