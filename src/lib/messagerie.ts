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

/** Statut d'un message de MON côté : enregistré sur le serveur, ou lu par l'autre côté. */
export type DeliveryStatus = "DISTRIBUE" | "LU";

/**
 * Accusé de lecture (ajouté après E12, à la demande de l'étudiant). Un message est « lu » dès
 * qu'un participant d'un AUTRE côté a lu la conversation jusqu'à lui (sa dernière lecture est
 * postérieure ou égale au message) ; sinon il est « distribué ». Côté agence, la boîte étant
 * partagée, il suffit qu'un seul membre de l'équipe l'ait lu. Les messages de l'autre côté
 * n'ont pas de statut (`null`) : on ne l'affiche que sous ses propres messages.
 */
export function deliveryStatus(
  message: { createdAt: Date; auteurRole: Role },
  viewerRole: Role,
  lectures: readonly { luJusqua: Date; role: Role }[],
): DeliveryStatus | null {
  const side = messagingSide(message.auteurRole);
  if (side !== messagingSide(viewerRole)) return null;
  return lectures.some((l) => messagingSide(l.role) !== side && l.luJusqua >= message.createdAt)
    ? "LU"
    : "DISTRIBUE";
}

/** Rôles d'un autre côté que `role` (destinataires possibles d'un accusé de lecture). */
export function otherSideRoles(role: Role): Role[] {
  const all: Role[] = ["SUPER_ADMIN", "ADMIN_AGENCE", "STAFF", "GUIDE", "CLIENT"];
  return all.filter((r) => messagingSide(r) !== messagingSide(role) && r !== "SUPER_ADMIN");
}
