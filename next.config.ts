import { networkInterfaces } from "node:os";

import type { NextConfig } from "next";

import { lanAddress } from "./src/lib/network";

// Adresse de l'ordinateur sur le Wi-Fi : le QR code des factures y renvoie quand l'application
// est ouverte via localhost ; un téléphone doit donc pouvoir utiliser le serveur de dev.
const lanIp = lanAddress(networkInterfaces());

const nextConfig: NextConfig = {
  logging: {
    // En développement, Next.js affiche par défaut les arguments des actions serveur :
    // mots de passe compris. Désactivé (cahier des charges §12 : aucune donnée sensible
    // dans les journaux).
    serverFunctions: false,
  },
  // Origines autorisées à utiliser le serveur de développement en plus de localhost, par
  // exemple l'adresse IP du poste pour tester sur téléphone (mobile d'abord, §8.5).
  // Liste séparée par des virgules dans ALLOWED_DEV_ORIGINS (.env). Sans effet en production.
  allowedDevOrigins: [
    ...(process.env.ALLOWED_DEV_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    ...(lanIp ? [lanIp] : []),
  ],
};

export default nextConfig;
