import { createHash, randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { failure, type ServiceResult, success } from "@/lib/services/result";

/**
 * « Mot de passe oublié » (après E12). Parcours sans session : client non confiné
 * (`getAdminDb`), comme l'authentification.
 *
 * Sécurité :
 * - le jeton (32 octets aléatoires) n'est envoyé que par e-mail ; la base ne garde que son
 *   EMPREINTE SHA-256 : une fuite de la base ne permet pas de réinitialiser un compte ;
 * - valable 1 heure, utilisable une seule fois (réservation atomique du jeton), et les
 *   autres liens de l'utilisateur sont annulés après le changement ;
 * - au plus 3 demandes par heure et par compte ;
 * - la demande renvoie toujours la même réponse, que l'adresse existe ou non (c'est l'action
 *   qui l'assure) : on ne révèle pas quels comptes existent ;
 * - un voyageur ne réinitialise que son compte de l'agence du site (même adresse possible dans
 *   plusieurs agences) ; le personnel et le super admin passent par la page de la plateforme.
 */

export const RESET_VALIDITY_MINUTES = 60;
export const RESET_MAX_PER_HOUR = 3;
const BCRYPT_COST = 10;

export function hashResetToken(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

/** Compte visé par la demande (actif, agence non suspendue). */
function accountWhere(email: string, agenceSlug: string | null): Prisma.UtilisateurWhereInput {
  return agenceSlug
    ? { email, actif: true, role: "CLIENT", agence: { slug: agenceSlug, statut: "ACTIVE" } }
    : {
        email,
        actif: true,
        role: { not: "CLIENT" },
        OR: [{ agenceId: null }, { agence: { statut: "ACTIVE" } }],
      };
}

export type ResetRequest = {
  to: string;
  prenom: string;
  jeton: string;
  /** Nom affiché dans l'e-mail : l'agence (voyageur) ou « Green Trek » (personnel). */
  espace: string;
  agenceSlug: string | null;
};

/**
 * Crée un lien de réinitialisation. `null` si aucun compte ne correspond ou si la limite de
 * demandes est atteinte (l'appelant répond la même chose dans tous les cas).
 */
export async function requestPasswordReset(
  client: PrismaClient,
  input: { email: string; agenceSlug: string | null },
  now: Date = new Date(),
): Promise<ResetRequest | null> {
  const user = await client.utilisateur.findFirst({
    where: accountWhere(input.email, input.agenceSlug),
    select: { id: true, prenom: true, email: true, agence: { select: { nom: true } } },
  });
  if (!user) return null;

  const recentes = await client.jetonReinitialisation.count({
    where: { utilisateurId: user.id, createdAt: { gte: new Date(now.getTime() - 3_600_000) } },
  });
  if (recentes >= RESET_MAX_PER_HOUR) return null;

  const jeton = randomBytes(32).toString("base64url");
  await client.jetonReinitialisation.create({
    data: {
      utilisateurId: user.id,
      empreinte: hashResetToken(jeton),
      expireAt: new Date(now.getTime() + RESET_VALIDITY_MINUTES * 60_000),
      createdAt: now,
    },
  });
  return {
    to: user.email,
    prenom: user.prenom,
    jeton,
    espace: input.agenceSlug && user.agence ? user.agence.nom : "Green Trek",
    agenceSlug: input.agenceSlug,
  };
}

const tokenSelect = {
  id: true,
  expireAt: true,
  utiliseAt: true,
  utilisateur: {
    select: {
      id: true,
      prenom: true,
      actif: true,
      role: true,
      agence: { select: { slug: true, statut: true } },
    },
  },
} satisfies Prisma.JetonReinitialisationSelect;

type TokenRow = Prisma.JetonReinitialisationGetPayload<{ select: typeof tokenSelect }>;

/** Jeton utilisable : non utilisé, non expiré, compte actif, agence non suspendue. */
function usable(token: TokenRow | null, now: Date, agenceSlug: string | null): token is TokenRow {
  if (!token || token.utiliseAt || token.expireAt <= now) return false;
  const u = token.utilisateur;
  if (!u.actif || (u.agence && u.agence.statut !== "ACTIVE")) return false;
  // Le lien d'un voyageur s'ouvre sur le site de SON agence, celui du personnel sur la plateforme.
  return agenceSlug ? u.role === "CLIENT" && u.agence?.slug === agenceSlug : u.role !== "CLIENT";
}

const INVALID = "Ce lien n'est plus valable (déjà utilisé ou expiré). Faites une nouvelle demande.";

/** Vérifie le lien à l'ouverture de la page (pour afficher le formulaire ou un message). */
export async function checkResetToken(
  client: PrismaClient,
  jeton: string,
  agenceSlug: string | null,
  now: Date = new Date(),
): Promise<{ prenom: string } | null> {
  const token = await client.jetonReinitialisation.findUnique({
    where: { empreinte: hashResetToken(jeton) },
    select: tokenSelect,
  });
  return usable(token, now, agenceSlug) ? { prenom: token.utilisateur.prenom } : null;
}

/** Enregistre le nouveau mot de passe et consomme le lien (une seule fois). */
export async function resetPassword(
  client: PrismaClient,
  input: { jeton: string; password: string; agenceSlug: string | null },
  now: Date = new Date(),
): Promise<ServiceResult> {
  const token = await client.jetonReinitialisation.findUnique({
    where: { empreinte: hashResetToken(input.jeton) },
    select: tokenSelect,
  });
  if (!usable(token, now, input.agenceSlug)) return failure(INVALID);

  const motDePasseHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const ok = await client.$transaction(async (tx) => {
    // Réservation atomique : deux envois simultanés du même lien, un seul réussit.
    const claimed = await tx.jetonReinitialisation.updateMany({
      where: { id: token.id, utiliseAt: null },
      data: { utiliseAt: now },
    });
    if (claimed.count !== 1) return false;
    await tx.utilisateur.update({
      where: { id: token.utilisateur.id },
      data: { motDePasseHash },
    });
    // Les autres liens encore valables de ce compte sont annulés.
    await tx.jetonReinitialisation.updateMany({
      where: { utilisateurId: token.utilisateur.id, utiliseAt: null },
      data: { utiliseAt: now },
    });
    return true;
  });
  return ok ? success(undefined) : failure(INVALID);
}
