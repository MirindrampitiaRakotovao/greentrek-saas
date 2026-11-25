-- CreateTable
CREATE TABLE `DepartSurMesure` (
    `id` VARCHAR(191) NOT NULL,
    `agenceId` VARCHAR(191) NOT NULL,
    `itineraireId` VARCHAR(191) NOT NULL,
    `guideId` VARCHAR(191) NULL,
    `dateDebut` DATE NOT NULL,
    `dateFin` DATE NOT NULL,
    `nombrePersonnes` INTEGER NOT NULL,
    `remarques` TEXT NULL,
    `statut` ENUM('DEMANDE', 'CONFIRME', 'REFUSE', 'ANNULE') NOT NULL DEFAULT 'DEMANDE',
    `tarif` INTEGER NULL,
    `reponse` TEXT NULL,
    `reponduAt` DATETIME(3) NULL,
    `annuleAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DepartSurMesure_agenceId_dateDebut_idx`(`agenceId`, `dateDebut`),
    INDEX `DepartSurMesure_itineraireId_idx`(`itineraireId`),
    INDEX `DepartSurMesure_guideId_idx`(`guideId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DepartSurMesure` ADD CONSTRAINT `DepartSurMesure_agenceId_fkey` FOREIGN KEY (`agenceId`) REFERENCES `Agence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DepartSurMesure` ADD CONSTRAINT `DepartSurMesure_itineraireId_fkey` FOREIGN KEY (`itineraireId`) REFERENCES `ItinerairePersonnalise`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DepartSurMesure` ADD CONSTRAINT `DepartSurMesure_guideId_fkey` FOREIGN KEY (`guideId`) REFERENCES `Guide`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Contraintes de cohérence (étape 9) : fin ≥ début, au moins une personne, tarif positif.
ALTER TABLE `DepartSurMesure` ADD CONSTRAINT `DepartSurMesure_dates_check` CHECK (`dateFin` >= `dateDebut`);
ALTER TABLE `DepartSurMesure` ADD CONSTRAINT `DepartSurMesure_personnes_check` CHECK (`nombrePersonnes` > 0);
ALTER TABLE `DepartSurMesure` ADD CONSTRAINT `DepartSurMesure_tarif_check` CHECK (`tarif` IS NULL OR `tarif` >= 0);
