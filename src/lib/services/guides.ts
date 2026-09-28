import type { Prisma } from "@/generated/prisma/client";
import { type Paginated, pageArgs, pageCount } from "@/lib/pagination";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import type { TenantDb } from "@/lib/tenant";
import type { GuideInput } from "@/lib/validators/backoffice";

/**
 * Fiches des guides (§5.2, table 9). Un guide peut ne pas avoir de compte ; s'il en a un,
 * c'est un compte de rôle GUIDE de la même agence, relié à une seule fiche.
 * Suppression possible seulement si la fiche n'encadre aucun départ et n'est reliée à aucun
 * compte ; sinon on la désactive (décision D de l'étape E3).
 */

const guideSelect = {
  id: true,
  nom: true,
  prenom: true,
  telephone: true,
  bio: true,
  langues: true,
  experienceAnnees: true,
  actif: true,
  utilisateurId: true,
  utilisateur: { select: { email: true, actif: true } },
  _count: { select: { sessionsDepart: true } },
} satisfies Prisma.GuideSelect;

export type GuideRow = Prisma.GuideGetPayload<{ select: typeof guideSelect }>;

export async function listGuides(db: TenantDb, page: number): Promise<Paginated<GuideRow>> {
  const [items, total] = await Promise.all([
    db.guide.findMany({
      select: guideSelect,
      orderBy: [{ actif: "desc" }, { nom: "asc" }, { prenom: "asc" }],
      ...pageArgs(page),
    }),
    db.guide.count(),
  ]);
  return { items, total, page, pageCount: pageCount(total) };
}

export function getGuide(db: TenantDb, id: string): Promise<GuideRow | null> {
  return db.guide.findUnique({ where: { id }, select: guideSelect });
}

/** Comptes GUIDE de l'agence sans fiche, pouvant être reliés (plus le compte déjà relié). */
export function listLinkableGuideAccounts(db: TenantDb, currentUtilisateurId?: string | null) {
  return db.utilisateur.findMany({
    where: {
      role: "GUIDE",
      OR: [
        { guide: { is: null } },
        ...(currentUtilisateurId ? [{ id: currentUtilisateurId }] : []),
      ],
    },
    select: { id: true, prenom: true, nom: true, email: true },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  });
}

/** Le compte à relier doit être un compte GUIDE de l'agence, sans autre fiche. */
async function checkLinkableAccount(
  db: TenantDb,
  utilisateurId: string | null,
  guideId?: string,
): Promise<ServiceResult> {
  if (!utilisateurId) return success(undefined);
  const compte = await db.utilisateur.findFirst({
    where: { id: utilisateurId },
    select: { role: true, guide: { select: { id: true } } },
  });
  if (!compte || compte.role !== "GUIDE") {
    return failure("Seul un compte de rôle Guide de l'agence peut être relié.", "utilisateurId");
  }
  if (compte.guide && compte.guide.id !== guideId) {
    return failure("Ce compte est déjà relié à une autre fiche.", "utilisateurId");
  }
  return success(undefined);
}

export async function createGuide(
  db: TenantDb,
  agenceId: string,
  input: GuideInput,
): Promise<ServiceResult<{ id: string }>> {
  const check = await checkLinkableAccount(db, input.utilisateurId);
  if (!check.ok) return check;
  const created = await db.guide.create({ data: { ...input, agenceId } });
  return success({ id: created.id });
}

export async function updateGuide(
  db: TenantDb,
  id: string,
  input: GuideInput,
): Promise<ServiceResult> {
  const guide = await getGuide(db, id);
  if (!guide) return failure("Guide introuvable.");
  const check = await checkLinkableAccount(db, input.utilisateurId, id);
  if (!check.ok) return check;
  await db.guide.update({ where: { id }, data: input });
  return success(undefined);
}

export async function deleteGuide(db: TenantDb, id: string): Promise<ServiceResult> {
  const guide = await getGuide(db, id);
  if (!guide) return failure("Guide introuvable.");
  const departs = guide._count.sessionsDepart;
  if (departs > 0) {
    return failure(
      `Ce guide encadre ${departs} départ${departs > 1 ? "s" : ""} : désactivez-le plutôt que de le supprimer.`,
    );
  }
  if (guide.utilisateurId) {
    return failure(
      "Cette fiche est reliée à un compte : retirez d'abord le lien, ou désactivez la fiche.",
    );
  }
  await db.guide.delete({ where: { id } });
  return success(undefined);
}

/** Langues d'une fiche (champ JSON) sous forme de liste de codes ; ignore toute valeur invalide. */
export function languageCodes(langues: Prisma.JsonValue): string[] {
  return Array.isArray(langues)
    ? langues.filter((code): code is string => typeof code === "string")
    : [];
}
