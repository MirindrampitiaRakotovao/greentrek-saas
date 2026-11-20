-- AlterTable
ALTER TABLE `Troncon` ADD COLUMN `trace` JSON NULL,
    ADD COLUMN `traceSource` ENUM('OSM', 'MANUEL') NULL;
