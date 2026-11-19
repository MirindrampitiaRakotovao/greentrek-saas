-- AlterTable
ALTER TABLE `Conversation` ADD COLUMN `destinataireId` VARCHAR(191) NULL,
    ADD COLUMN `type` ENUM('AGENCE', 'VOYAGEURS') NOT NULL DEFAULT 'AGENCE';

-- AlterTable
ALTER TABLE `Utilisateur` ADD COLUMN `derniereActiviteAt` DATETIME(3) NULL,
    ADD COLUMN `messagesVoyageurs` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `presenceVisible` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `Blocage` (
    `id` VARCHAR(191) NOT NULL,
    `agenceId` VARCHAR(191) NOT NULL,
    `bloqueurId` VARCHAR(191) NOT NULL,
    `bloqueId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Blocage_agenceId_idx`(`agenceId`),
    INDEX `Blocage_bloqueId_idx`(`bloqueId`),
    UNIQUE INDEX `Blocage_bloqueurId_bloqueId_key`(`bloqueurId`, `bloqueId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Signalement` (
    `id` VARCHAR(191) NOT NULL,
    `agenceId` VARCHAR(191) NOT NULL,
    `auteurId` VARCHAR(191) NOT NULL,
    `cible` ENUM('MESSAGE', 'PUBLICATION', 'COMMENTAIRE') NOT NULL,
    `cibleId` VARCHAR(30) NOT NULL,
    `motif` TEXT NULL,
    `statut` ENUM('OUVERT', 'TRAITE') NOT NULL DEFAULT 'OUVERT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `traiteAt` DATETIME(3) NULL,

    INDEX `Signalement_agenceId_statut_idx`(`agenceId`, `statut`),
    UNIQUE INDEX `Signalement_auteurId_cible_cibleId_key`(`auteurId`, `cible`, `cibleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Conversation_destinataireId_idx` ON `Conversation`(`destinataireId`);

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_destinataireId_fkey` FOREIGN KEY (`destinataireId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Blocage` ADD CONSTRAINT `Blocage_agenceId_fkey` FOREIGN KEY (`agenceId`) REFERENCES `Agence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Blocage` ADD CONSTRAINT `Blocage_bloqueurId_fkey` FOREIGN KEY (`bloqueurId`) REFERENCES `Utilisateur`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Blocage` ADD CONSTRAINT `Blocage_bloqueId_fkey` FOREIGN KEY (`bloqueId`) REFERENCES `Utilisateur`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Signalement` ADD CONSTRAINT `Signalement_agenceId_fkey` FOREIGN KEY (`agenceId`) REFERENCES `Agence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Signalement` ADD CONSTRAINT `Signalement_auteurId_fkey` FOREIGN KEY (`auteurId`) REFERENCES `Utilisateur`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
