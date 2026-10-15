import type { Role } from "@/generated/prisma/client";

// Ajout des champs métier (rôle, agence) aux types Auth.js : la session et le jeton
// contiennent userId, role et agenceId (cahier des charges §4).

declare module "next-auth" {
  interface User {
    role: Role;
    agenceId: string | null;
    agenceSlug: string | null;
    /** « Se souvenir de moi » coché à la connexion. */
    remember?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      agenceId: string | null;
      agenceSlug: string | null;
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId: string;
    role: Role;
    agenceId: string | null;
    agenceSlug: string | null;
    /** Session de 30 jours (sinon 8 heures après `loginAt`). */
    remember?: boolean;
    /** Heure de connexion (ms depuis 1970). */
    loginAt?: number;
  }
}
