import type { Role } from "@/generated/prisma/client";

/**
 * Règles pures de la messagerie (sans base de données), testées unitairement.
 *
 * Côté agence, la boîte est PARTAGÉE : l'administrateur et le personnel forment un seul
 * interlocuteur (« l'agence »). Un message écrit par un collègue n'est donc pas signalé
 * comme non lu : seul compte ce qui vient de l'autre côté (client ou guide).
 */

export type Side = "AGENCE" | "GUIDE" | "CLIENT" | "AUTRE";

export function messagingSide(role: Role): Side {
  switch (role) {
    case "ADMIN_AGENCE":
    case "STAFF":
      return "AGENCE";
    case "GUIDE":
      return "GUIDE";
    case "CLIENT":
      return "CLIENT";
    default:
      return "AUTRE";
  }
}

/** Libellé de l'auteur d'un message, affiché à côté de son nom. */
export const SIDE_LABELS: Record<Side, string> = {
  AGENCE: "Agence",
  GUIDE: "Guide",
  CLIENT: "Voyageur",
  AUTRE: "",
};

/**
 * Une conversation est non lue pour `viewerRole` si son dernier message vient d'un autre
 * côté et qu'il est postérieur à la dernière lecture de l'utilisateur.
 */
export function isUnread(
  viewerRole: Role,
  last: { createdAt: Date; auteurRole: Role } | null,
  luJusqua: Date | null,
): boolean {
  if (!last) return false;
  if (messagingSide(last.auteurRole) === messagingSide(viewerRole)) return false;
  return luJusqua === null || last.createdAt > luJusqua;
}
