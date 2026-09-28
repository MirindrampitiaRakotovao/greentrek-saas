import bcrypt from "bcryptjs";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { getAdminDb } from "@/lib/admin-db";
import { isStaffEmailTaken } from "@/lib/auth/authenticate";
import type { AgencyRegistrationInput } from "@/lib/validators/auth";

/** Durée de la période d'essai offerte à l'inscription (abonnement simulé). */
export const TRIAL_DAYS = 30;
const BCRYPT_COST = 10;

export type OnboardingResult =
  | { ok: true; agenceId: string; slug: string }
  | { ok: false; field: "slug" | "email" | "form"; message: string };

/**
 * Inscription d'une agence (cahier des charges §7.5) : crée, dans une seule transaction,
 * l'Agence, son premier Utilisateur ADMIN_AGENCE et un Abonnement ESSAI.
 * Si une des trois créations échoue, rien n'est enregistré.
 *
 * C'est une opération de la plateforme (l'agence n'existe pas encore) : elle utilise donc
 * le client non confiné. Les entrées ont déjà été validées par Zod.
 */
export async function registerAgency(
  input: AgencyRegistrationInput,
  client: PrismaClient = getAdminDb(),
): Promise<OnboardingResult> {
  if (await client.agence.findUnique({ where: { slug: input.slug }, select: { id: true } })) {
    return { ok: false, field: "slug", message: "Cet identifiant d'agence est déjà pris." };
  }
  if (await isStaffEmailTaken(input.email, client)) {
    return { ok: false, field: "email", message: "Cette adresse e-mail est déjà utilisée." };
  }

  const planEssai = await client.plan.findUnique({ where: { code: "ESSAI" } });
  if (!planEssai) {
    return { ok: false, field: "form", message: "Plan d'essai introuvable : lancer le seed." };
  }

  const motDePasseHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const dateDebut = new Date();
  const dateFin = new Date(dateDebut.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  try {
    const agence = await client.$transaction(async (tx) => {
      const created = await tx.agence.create({ data: { nom: input.nomAgence, slug: input.slug } });
      await tx.utilisateur.create({
        data: {
          agenceId: created.id,
          nom: input.nom,
          prenom: input.prenom,
          email: input.email,
          motDePasseHash,
          role: "ADMIN_AGENCE",
        },
      });
      await tx.abonnement.create({
        data: {
          agenceId: created.id,
          planId: planEssai.id,
          dateDebut,
          dateFin,
          statut: "ESSAI",
        },
      });
      return created;
    });
    return { ok: true, agenceId: agence.id, slug: agence.slug };
  } catch (error: unknown) {
    // Deux inscriptions simultanées avec le même slug : l'index unique tranche.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, field: "slug", message: "Cet identifiant d'agence est déjà pris." };
    }
    throw error;
  }
}
