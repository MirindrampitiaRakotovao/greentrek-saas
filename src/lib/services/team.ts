import bcrypt from "bcryptjs";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { getAdminDb } from "@/lib/admin-db";
import { isStaffEmailTaken } from "@/lib/auth/authenticate";
import { type Paginated, pageArgs, pageCount } from "@/lib/pagination";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import type { TenantDb } from "@/lib/tenant";
import {
  type ChangePasswordInput,
  type CreateMemberInput,
  TEAM_ROLES,
  type UpdateMemberInput,
  type UpdateProfileInput,
} from "@/lib/validators/team";

/**
 * Gestion de l'équipe d'une agence (cahier des charges §7.3 « Équipe ») et profil personnel.
 *
 * Toutes les fonctions reçoivent le client confiné à l'agence (`TenantDb`) : un membre d'une
 * autre agence est donc introuvable. Règles de gestion appliquées ici :
 * - l'e-mail du personnel est unique sur toute la plateforme (connexion par `/connexion`) ;
 * - pas de suppression d'utilisateur, seulement la désactivation (historique conservé) ;
 * - on ne peut ni se désactiver soi-même, ni changer son propre rôle ;
 * - l'agence garde toujours au moins un ADMIN_AGENCE actif ;
 * - un compte GUIDE est relié à une fiche Guide (créée automatiquement si besoin).
 */

const BCRYPT_COST = 10;

const memberSelect = {
  id: true,
  nom: true,
  prenom: true,
  email: true,
  telephone: true,
  role: true,
  actif: true,
  dernierLoginAt: true,
  createdAt: true,
} satisfies Prisma.UtilisateurSelect;

export type TeamMember = Prisma.UtilisateurGetPayload<{ select: typeof memberSelect }>;

const teamWhere = { role: { in: [...TEAM_ROLES] } } satisfies Prisma.UtilisateurWhereInput;

export async function listTeam(db: TenantDb, page: number): Promise<Paginated<TeamMember>> {
  const [items, total] = await Promise.all([
    db.utilisateur.findMany({
      where: teamWhere,
      select: memberSelect,
      orderBy: [{ actif: "desc" }, { nom: "asc" }, { prenom: "asc" }],
      ...pageArgs(page),
    }),
    db.utilisateur.count({ where: teamWhere }),
  ]);
  return { items, total, page, pageCount: pageCount(total) };
}

export async function getTeamMember(db: TenantDb, id: string): Promise<TeamMember | null> {
  return db.utilisateur.findFirst({ where: { id, ...teamWhere }, select: memberSelect });
}

function countActiveAdmins(db: TenantDb): Promise<number> {
  return db.utilisateur.count({ where: { role: "ADMIN_AGENCE", actif: true } });
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const EMAIL_TAKEN = "Cette adresse e-mail est déjà utilisée.";

/** Crée un membre de l'équipe (et sa fiche Guide si le rôle est GUIDE). */
export async function createMember(
  db: TenantDb,
  agenceId: string,
  input: CreateMemberInput,
  platformDb: PrismaClient = getAdminDb(),
): Promise<ServiceResult<{ id: string }>> {
  // Contrôle sur toute la plateforme : nécessite le client non confiné.
  if (await isStaffEmailTaken(input.email, platformDb)) return failure(EMAIL_TAKEN, "email");

  const motDePasseHash = await bcrypt.hash(input.password, BCRYPT_COST);
  try {
    const created = await db.$tenantTransaction(async (tx) => {
      const utilisateur = await tx.utilisateur.create({
        data: {
          agenceId,
          prenom: input.prenom,
          nom: input.nom,
          email: input.email,
          telephone: input.telephone,
          role: input.role,
          motDePasseHash,
        },
      });
      if (input.role === "GUIDE") {
        await tx.guide.create({
          data: {
            agenceId,
            utilisateurId: utilisateur.id,
            prenom: input.prenom,
            nom: input.nom,
            telephone: input.telephone,
            langues: [],
          },
        });
      }
      return utilisateur;
    });
    return success({ id: created.id });
  } catch (error: unknown) {
    // Même e-mail qu'un client de cette agence : l'index unique (agenceId, email) tranche.
    if (isUniqueViolation(error)) return failure(EMAIL_TAKEN, "email");
    throw error;
  }
}

/** Modifie l'identité et le rôle d'un membre. */
export async function updateMember(
  db: TenantDb,
  agenceId: string,
  actorId: string,
  input: UpdateMemberInput,
): Promise<ServiceResult> {
  const member = await getTeamMember(db, input.id);
  if (!member) return failure("Membre introuvable.");

  if (member.role !== input.role) {
    if (member.id === actorId)
      return failure("Vous ne pouvez pas changer votre propre rôle.", "role");
    if (member.role === "ADMIN_AGENCE" && member.actif && (await countActiveAdmins(db)) <= 1) {
      return failure("L'agence doit garder au moins un administrateur actif.", "role");
    }
  }

  await db.$tenantTransaction(async (tx) => {
    await tx.utilisateur.update({
      where: { id: member.id },
      data: { prenom: input.prenom, nom: input.nom, telephone: input.telephone, role: input.role },
    });

    const fiche = await tx.guide.findFirst({ where: { utilisateurId: member.id } });
    if (input.role === "GUIDE" && !fiche) {
      await tx.guide.create({
        data: {
          agenceId,
          utilisateurId: member.id,
          prenom: input.prenom,
          nom: input.nom,
          telephone: input.telephone,
          langues: [],
        },
      });
    } else if (input.role !== "GUIDE" && fiche) {
      // La fiche reste (départs déjà encadrés) mais n'est plus reliée à un compte.
      await tx.guide.update({ where: { id: fiche.id }, data: { utilisateurId: null } });
    }
  });
  return success(undefined);
}

/** Active ou désactive un membre (pas de suppression : l'historique est conservé). */
export async function setMemberActive(
  db: TenantDb,
  actorId: string,
  id: string,
  actif: boolean,
): Promise<ServiceResult> {
  const member = await getTeamMember(db, id);
  if (!member) return failure("Membre introuvable.");
  if (!actif) {
    if (member.id === actorId) return failure("Vous ne pouvez pas désactiver votre propre compte.");
    if (member.role === "ADMIN_AGENCE" && member.actif && (await countActiveAdmins(db)) <= 1) {
      return failure("L'agence doit garder au moins un administrateur actif.");
    }
  }
  await db.utilisateur.update({ where: { id }, data: { actif } });
  return success(undefined);
}

/** Profil personnel : nom, prénom, téléphone. */
export async function updateProfile(
  db: TenantDb,
  userId: string,
  input: UpdateProfileInput,
): Promise<ServiceResult> {
  const result = await db.utilisateur.updateMany({
    where: { id: userId },
    data: { prenom: input.prenom, nom: input.nom, telephone: input.telephone },
  });
  return result.count === 1 ? success(undefined) : failure("Compte introuvable.");
}

/** Changement de mot de passe : l'ancien est exigé (protection si la session est laissée ouverte). */
export async function changePassword(
  db: TenantDb,
  userId: string,
  input: ChangePasswordInput,
): Promise<ServiceResult> {
  const utilisateur = await db.utilisateur.findUnique({
    where: { id: userId },
    select: { motDePasseHash: true },
  });
  if (!utilisateur) return failure("Compte introuvable.");
  if (!(await bcrypt.compare(input.currentPassword, utilisateur.motDePasseHash))) {
    return failure("Mot de passe actuel incorrect.", "currentPassword");
  }
  await db.utilisateur.update({
    where: { id: userId },
    data: { motDePasseHash: await bcrypt.hash(input.newPassword, BCRYPT_COST) },
  });
  return success(undefined);
}
