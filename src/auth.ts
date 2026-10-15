import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/auth.config";
import { authenticate } from "@/lib/auth/authenticate";
import { loginSchema } from "@/lib/validators/auth";

/**
 * Configuration complète d'Auth.js v5 : connexion par e-mail et mot de passe.
 * `authorize` revalide les champs avec Zod (frontière serveur), puis délègue la
 * vérification à `authenticate` (testée en intégration).
 */
export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Mot de passe", type: "password" },
        agenceSlug: { type: "hidden" },
        remember: { type: "checkbox" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse({
          ...credentials,
          // Champ caché vide sur /connexion : absent plutôt que chaîne vide.
          agenceSlug: credentials.agenceSlug || undefined,
        });
        if (!parsed.success) return null;
        const user = await authenticate(parsed.data);
        return user ? { ...user, remember: parsed.data.remember === true } : null;
      },
    }),
  ],
});
