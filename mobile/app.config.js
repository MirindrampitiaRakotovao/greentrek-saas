const fs = require("node:fs");

/**
 * Configuration dynamique (complète `app.json`) : fichier Firebase d'Android pour les
 * notifications push. Il n'est pas versionné (`.gitignore`) : pendant la fabrication de l'APK,
 * EAS le fournit par la variable de type fichier `GOOGLE_SERVICES_JSON` ; en local, il est lu
 * dans `mobile/google-services.json` s'il existe.
 */
module.exports = ({ config }) => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ??
    (fs.existsSync("./google-services.json") ? "./google-services.json" : undefined);
  return {
    ...config,
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
  };
};
