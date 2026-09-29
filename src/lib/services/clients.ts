import bcrypt from "bcryptjs";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { getAdminDb } from "@/lib/admin-db";
import type { ClientRegistrationInput } from "@/lib/validators/auth";

const BCRYPT_COST = 10;

export type ClientRegistrationResult =
  { ok: true; clientId: string } | { ok: false; field: "email" | "form"; message: string };

const EMAIL_TAKEN = "Un compte existe déjà avec cette adresse : connectez-vous.";

/**
 * Inscription d'un voyageur sur le site d'une agence (§7.2) : compte de rôle CLIENT, rattaché
 * à l'agence du slug (RG 2), e-mail unique au sein de l'agence (RG 3). Comme la connexion,
 * c'est une opération d'avant session (l'agence vient de l'URL) : client non confiné, mais
 * il ne crée que des comptes CLIENT, et seulement pour une agence ACTIVE (RG 19).
 */
export async function registerClient(
  input: ClientRegistrationInput,
  client: PrismaClient = getAdminDb(),
): Promise<ClientRegistrationResult> {
  const agence = await client.agence.findFirst({
    where: { slug: input.agenceSlug, statut: "ACTIVE" },
    select: { id: true },
  });
  if (!agence) return { ok: false, field: "form", message: "Agence introuvable." };

  const existing = await client.utilisateur.findFirst({
    where: { agenceId: agence.id, email: input.email },
    select: { id: true },
  });
  if (existing) return { ok: false, field: "email", message: EMAIL_TAKEN };

  try {
    const created = await client.utilisateur.create({
      data: {
        agenceId: agence.id,
        prenom: input.prenom,
        nom: input.nom,
        email: input.email,
        telephone: input.telephone,
        motDePasseHash: await bcrypt.hash(input.password, BCRYPT_COST),
        role: "CLIENT",
      },
      select: { id: true },
    });
    return { ok: true, clientId: created.id };
  } catch (error: unknown) {
    // Deux inscriptions simultanées avec la même adresse : l'index unique tranche.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, field: "email", message: EMAIL_TAKEN };
    }
    throw error;
  }
}
