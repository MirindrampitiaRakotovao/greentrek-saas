-- CreateTable
CREATE TABLE `AppareilMobile` (
    `id` VARCHAR(191) NOT NULL,
    `agenceId` VARCHAR(191) NOT NULL,
    `utilisateurId` VARCHAR(191) NOT NULL,
    `expoPushToken` VARCHAR(255) NOT NULL,
    `plateforme` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AppareilMobile_utilisateurId_idx`(`utilisateurId`),
    UNIQUE INDEX `AppareilMobile_agenceId_expoPushToken_key`(`agenceId`, `expoPushToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AppareilMobile` ADD CONSTRAINT `AppareilMobile_agenceId_fkey` FOREIGN KEY (`agenceId`) REFERENCES `Agence`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AppareilMobile` ADD CONSTRAINT `AppareilMobile_utilisateurId_fkey` FOREIGN KEY (`utilisateurId`) REFERENCES `Utilisateur`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
