import type { Role } from "@/generated/prisma/client";

/** Libellés français des rôles, pour l'affichage. */
export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super administrateur",
  ADMIN_AGENCE: "Administrateur d'agence",
  STAFF: "Personnel",
  GUIDE: "Guide",
  CLIENT: "Client",
};
