-- CreateTable
CREATE TABLE `Publication` (
    `id` VARCHAR(191) NOT NULL,
    `auteurId` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `legende` TEXT NULL,
    `photos` JSON NOT NULL,
    `statut` ENUM('VISIBLE', 'MASQUE') NOT NULL DEFAULT 'VISIBLE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `masqueAt` DATETIME(3) NULL,

    INDEX `Publication_statut_createdAt_idx`(`statut`, `createdAt`),
    INDEX `Publication_auteurId_idx`(`auteurId`),
    INDEX `Publication_reservationId_idx`(`reservationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Commentaire` (
    `id` VARCHAR(191) NOT NULL,
    `publicationId` VARCHAR(191) NOT NULL,
    `auteurId` VARCHAR(191) NOT NULL,
    `contenu` TEXT NOT NULL,
    `statut` ENUM('VISIBLE', 'MASQUE') NOT NULL DEFAULT 'VISIBLE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Commentaire_publicationId_createdAt_idx`(`publicationId`, `createdAt`),
    INDEX `Commentaire_auteurId_idx`(`auteurId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Jaime` (
    `publicationId` VARCHAR(191) NOT NULL,
    `utilisateurId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Jaime_utilisateurId_idx`(`utilisateurId`),
    PRIMARY KEY (`publicationId`, `utilisateurId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SignalementCommunaute` (
    `id` VARCHAR(191) NOT NULL,
    `auteurId` VARCHAR(191) NOT NULL,
    `cible` ENUM('MESSAGE', 'PUBLICATION', 'COMMENTAIRE') NOT NULL,
    `cibleId` VARCHAR(30) NOT NULL,
    `motif` TEXT NULL,
    `statut` ENUM('OUVERT', 'TRAITE') NOT NULL DEFAULT 'OUVERT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `traiteAt` DATETIME(3) NULL,

    INDEX `SignalementCommunaute_statut_createdAt_idx`(`statut`, `createdAt`),
    UNIQUE INDEX `SignalementCommunaute_auteurId_cible_cibleId_key`(`auteurId`, `cible`, `cibleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Publication` ADD CONSTRAINT `Publication_auteurId_fkey` FOREIGN KEY (`auteurId`) REFERENCES `Utilisateur`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Publication` ADD CONSTRAINT `Publication_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Commentaire` ADD CONSTRAINT `Commentaire_publicationId_fkey` FOREIGN KEY (`publicationId`) REFERENCES `Publication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Commentaire` ADD CONSTRAINT `Commentaire_auteurId_fkey` FOREIGN KEY (`auteurId`) REFERENCES `Utilisateur`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Jaime` ADD CONSTRAINT `Jaime_publicationId_fkey` FOREIGN KEY (`publicationId`) REFERENCES `Publication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Jaime` ADD CONSTRAINT `Jaime_utilisateurId_fkey` FOREIGN KEY (`utilisateurId`) REFERENCES `Utilisateur`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SignalementCommunaute` ADD CONSTRAINT `SignalementCommunaute_auteurId_fkey` FOREIGN KEY (`auteurId`) REFERENCES `Utilisateur`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
