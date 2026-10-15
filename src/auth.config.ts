import type { NextAuthConfig } from "next-auth";

/**
 * Partie de la configuration Auth.js sans accès à la base de données, utilisée par
 * `proxy.ts` (qui s'exécute sur chaque requête et ne doit faire que des vérifications
 * rapides à partir du cookie). La configuration complète est dans `src/auth.ts`.
 */
/** « Se souvenir de moi » coché : 30 jours. */
const REMEMBER_MAX_AGE_S = 30 * 24 * 60 * 60;
/** Case décochée : 8 heures (ordinateur partagé), comme avant cette option. */
export const SHORT_SESSION_MS = 8 * 60 * 60 * 1000;

export const authConfig = {
  // Jeton de session signé et chiffré dans un cookie (obligatoire avec Credentials).
  // Durée maximale : 30 jours (« Se souvenir de moi ») ; sans cette case, le rappel `jwt`
  // ci-dessous ferme la session 8 heures après la connexion.
  session: { strategy: "jwt", maxAge: REMEMBER_MAX_AGE_S },
  pages: { signIn: "/connexion" },
  // Démo locale (`next start` sur localhost) : on fait confiance à l'en-tête Host.
  trustHost: true,
  providers: [],
  logger: {
    // Un mot de passe erroné est un événement normal, pas une panne : on n'affiche pas de
    // trace d'erreur (et aucune donnée saisie n'est journalisée). Les vraies erreurs restent.
    error(error) {
      // On lit `type` (fourni par Auth.js) et non `name` : le build de production minifie
      // les noms de classes (`name` y vaut par exemple « z »).
      const type = "type" in error && typeof error.type === "string" ? error.type : error.name;
      if (type === "CredentialsSignin") return;
      // Cookie de session illisible (chiffré avec un autre AUTH_SECRET, par exemple après un
      // changement de secret ou venant d'une autre application sur localhost) : Auth.js
      // l'ignore et traite la requête comme celle d'un visiteur. Événement attendu, pas une
      // panne : un avertissement suffit (le site public lit la session à chaque page).
      if (type === "JWTSessionError") {
        console.warn("Auth.js : cookie de session illisible ignoré (visiteur non connecté).");
        return;
      }
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
        token.remember = user.remember === true;
        token.loginAt = Date.now();
      }
      // Auth.js ne permet qu'une durée de cookie pour tous : la session courte est donc
      // appliquée ici. Renvoyer `null` efface le cookie (l'utilisateur est déconnecté).
      if (!token.remember && Date.now() - (token.loginAt ?? 0) > SHORT_SESSION_MS) return null;
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
