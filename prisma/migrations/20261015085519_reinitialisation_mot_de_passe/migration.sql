-- CreateTable
CREATE TABLE `JetonReinitialisation` (
    `id` VARCHAR(191) NOT NULL,
    `utilisateurId` VARCHAR(191) NOT NULL,
    `empreinte` CHAR(64) NOT NULL,
    `expireAt` DATETIME(3) NOT NULL,
    `utiliseAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `JetonReinitialisation_empreinte_key`(`empreinte`),
    INDEX `JetonReinitialisation_utilisateurId_createdAt_idx`(`utilisateurId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `JetonReinitialisation` ADD CONSTRAINT `JetonReinitialisation_utilisateurId_fkey` FOREIGN KEY (`utilisateurId`) REFERENCES `Utilisateur`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
