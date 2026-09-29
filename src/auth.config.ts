import type { NextAuthConfig } from "next-auth";

/**
 * Partie de la configuration Auth.js sans accès à la base de données, utilisée par
 * `proxy.ts` (qui s'exécute sur chaque requête et ne doit faire que des vérifications
 * rapides à partir du cookie). La configuration complète est dans `src/auth.ts`.
 */
export const authConfig = {
  // Jeton de session signé et chiffré dans un cookie (obligatoire avec Credentials).
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8 heures
  pages: { signIn: "/connexion" },
  // Démo locale (`next start` sur localhost) : on fait confiance à l'en-tête Host.
  trustHost: true,
  providers: [],
  logger: {
    // Un mot de passe erroné est un événement normal, pas une panne : on n'affiche pas de
    // trace d'erreur (et aucune donnée saisie n'est journalisée). Les vraies erreurs restent.
    error(error) {
      if (error.name === "CredentialsSignin") return;
      console.error(error);
    },
  },
  callbacks: {
    // Copie des champs utiles dans le jeton à la connexion…
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id ?? "";
        token.role = user.role;
        token.agenceId = user.agenceId;
        token.agenceSlug = user.agenceSlug;
      }
      return token;
    },
    // … puis du jeton vers la session lue par l'application.
    session({ session, token }) {
      session.user.id = token.userId;
      session.user.role = token.role;
      session.user.agenceId = token.agenceId;
      session.user.agenceSlug = token.agenceSlug;
      return session;
    },
  },
} satisfies NextAuthConfig;
