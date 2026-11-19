import type { TenantDb } from "@/lib/tenant";

/**
 * Photo de profil et logo de l'agence (après E12). Le service enregistre l'adresse et renvoie
 * l'ancienne, que l'appelant supprime ensuite du disque. Client confiné : l'utilisateur et
 * l'agence sont ceux de la session.
 */
export async function setUserPhoto(
  db: TenantDb,
  utilisateurId: string,
  photoUrl: string | null,
): Promise<string | null> {
  const before = await db.utilisateur.findFirst({
    where: { id: utilisateurId },
    select: { photoUrl: true },
  });
  if (!before) return null;
  await db.utilisateur.updateMany({ where: { id: utilisateurId }, data: { photoUrl } });
  return before.photoUrl;
}

export async function setAgencyLogo(
  db: TenantDb,
  agenceId: string,
  logoUrl: string | null,
): Promise<string | null> {
  const before = await db.agence.findFirst({ where: { id: agenceId }, select: { logoUrl: true } });
  if (!before) return null;
  await db.agence.updateMany({ where: { id: agenceId }, data: { logoUrl } });
  return before.logoUrl;
}
