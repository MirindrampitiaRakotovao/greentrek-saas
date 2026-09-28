-- Initialisation de MySQL pour Green Trek SaaS (à exécuter une seule fois, en root) :
--   mysql -u root -p < scripts/init-db.sql
--
-- Crée la base applicative, la base « shadow » utilisée par `prisma migrate dev`
-- pour détecter les dérives de schéma, et un utilisateur dédié (principe du
-- moindre privilège : l'application ne se connecte jamais en root).
-- Remplacez le mot de passe ci-dessous et reportez-le dans votre fichier `.env`.

CREATE DATABASE IF NOT EXISTS greentrek
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS greentrek_shadow
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'greentrek'@'localhost' IDENTIFIED BY 'change-moi';

GRANT ALL PRIVILEGES ON greentrek.* TO 'greentrek'@'localhost';
GRANT ALL PRIVILEGES ON greentrek_shadow.* TO 'greentrek'@'localhost';
FLUSH PRIVILEGES;
