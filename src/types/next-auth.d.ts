import type { Role } from "@/generated/prisma/client";

// Ajout des champs métier (rôle, agence) aux types Auth.js : la session et le jeton
// contiennent userId, role et agenceId (cahier des charges §4).

declare module "next-auth" {
  interface User {
    role: Role;
    agenceId: string | null;
    agenceSlug: string | null;
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
  }
}
