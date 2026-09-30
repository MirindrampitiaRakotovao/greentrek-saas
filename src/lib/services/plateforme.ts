import { Prisma, type PrismaClient, type StatutAgence } from "@/generated/prisma/client";
import { getAdminDb } from "@/lib/admin-db";
import { calendarDate } from "@/lib/dates";
import { type Paginated, pageArgs, pageCount } from "@/lib/pagination";
import { effectiveStatut } from "@/lib/plans";
import { getCurrentSubscription, getUsage } from "@/lib/services/abonnements";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import { getTenantDb } from "@/lib/tenant";
import type { AssignPlanInput, PlanInput } from "@/lib/validators/plateforme";

/**
 * Console du super administrateur (§7.4, étape E11) : supervision des agences, suspension,
 * plans et abonnements SIMULÉS. Opérations de la plateforme, sur toutes les agences : client
 * non confiné (`getAdminDb`), appelé seulement après la vérification du rôle SUPER_ADMIN
 * (actions et pages de `/admin`). Les chiffres propres à une agence passent, eux, par le
 * client confiné à cette agence (`getTenantDb`), comme partout ailleurs.
 */

const STAFF_ROLES = ["ADMIN_AGENCE", "STAFF", "GUIDE"] as const;

/* ─── Agences ────────────────────────────────────────────────────────────────── */

const agenceRowSelect = {
  id: true,
  nom: true,
  slug: true,
  ville: true,
  statut: true,
  createdAt: true,
  _count: {
    select: {
      circuits: true,
      reservations: true,
      utilisateurs: { where: { role: { in: [...STAFF_ROLES] } } },
    },
  },
  abonnements: {
    orderBy: [{ dateDebut: "desc" }, { id: "desc" }],
    take: 1,
    select: { statut: true, dateFin: true, plan: { select: { nom: true } } },
  },
} satisfies Prisma.AgenceSelect;

type AgenceRowPayload = Prisma.AgenceGetPayload<{ select: typeof agenceRowSelect }>;
export type AgenceRow = Omit<AgenceRowPayload, "abonnements"> & {
  abonnement: { plan: string; statut: ReturnType<typeof effectiveStatut> } | null;
};

export async function listAgences(
  q: string | undefined,
  page: number,
  now: Date = new Date(),
  client: PrismaClient = getAdminDb(),
): Promise<Paginated<AgenceRow>> {
  const search = q?.trim();
  const where: Prisma.AgenceWhereInput = search
    ? { OR: [{ nom: { contains: search } }, { slug: { contains: search } }] }
    : {};
  const [items, total] = await Promise.all([
    client.agence.findMany({
      where,
      select: agenceRowSelect,
      orderBy: [{ statut: "asc" }, { nom: "asc" }],
      ...pageArgs(page),
    }),
    client.agence.count({ where }),
  ]);
  const today = calendarDate(now);
  return {
    items: items.map(({ abonnements, ...a }) => {
      const current = abonnements[0];
      return {
        ...a,
        abonnement: current
          ? { plan: current.plan.nom, statut: effectiveStatut(current, today) }
          : null,
      };
    }),
    total,
    page,
    pageCount: pageCount(total),
  };
}

/** Fiche d'une agence : chiffres, abonnement courant et utilisation, historique. */
export async function getAgence(
  id: string,
  now: Date = new Date(),
  client: PrismaClient = getAdminDb(),
) {
  const agence = await client.agence.findUnique({
    where: { id },
    select: {
      id: true,
      nom: true,
      slug: true,
      email: true,
      telephone: true,
      ville: true,
      pays: true,
      statut: true,
      createdAt: true,
      _count: {
        select: {
          circuits: true,
          reservations: true,
          sessionsDepart: true,
          utilisateurs: { where: { role: "CLIENT" } },
        },
      },
      abonnements: {
        orderBy: [{ dateDebut: "desc" }, { id: "desc" }],
        select: {
          id: true,
          statut: true,
          dateDebut: true,
          dateFin: true,
          plan: { select: { nom: true, prixMensuel: true } },
        },
      },
    },
  });
  if (!agence) return null;
  // Chiffres propres à l'agence : client confiné à cette agence.
  const db = getTenantDb(agence.id, client);
  const [subscription, usage] = await Promise.all([
    getCurrentSubscription(db, now),
    getUsage(db, now),
  ]);
  const today = calendarDate(now);
  return {
    ...agence,
    abonnements: agence.abonnements.map((a) => ({ ...a, statut: effectiveStatut(a, today) })),
    subscription,
    usage,
  };
}

/**
 * Suspension ou réactivation (RG 19). Effet immédiat : la session de chaque utilisateur est
 * relue en base à chaque requête (`loadActiveUser`), la connexion est refusée et le site
 * vitrine renvoie une page 404 tant que l'agence est suspendue.
 */
export async function setAgenceStatut(
  id: string,
  statut: StatutAgence,
  client: PrismaClient = getAdminDb(),
): Promise<ServiceResult> {
  const result = await client.agence.updateMany({ where: { id }, data: { statut } });
  return result.count === 1 ? success(undefined) : failure("Agence introuvable.");
}

/** Date de fin d'un abonnement de `mois` mois commençant `debut` (dernier jour inclus). */
export function subscriptionEnd(debut: Date, mois: number): Date {
  const fin = new Date(debut);
  fin.setUTCMonth(fin.getUTCMonth() + mois);
  fin.setUTCDate(fin.getUTCDate() - 1);
  return fin;
}

/**
 * Attribution d'un plan (§7.4) : l'abonnement en cours (essai ou actif) est clôturé (ANNULE,
 * fin au jour même) et un nouvel abonnement commence aujourd'hui, dans une transaction.
 * Les nouvelles limites s'appliquent immédiatement.
 */
export async function assignPlan(
  input: AssignPlanInput,
  now: Date = new Date(),
  client: PrismaClient = getAdminDb(),
): Promise<ServiceResult> {
  const [agence, plan] = await Promise.all([
    client.agence.findUnique({ where: { id: input.agenceId }, select: { id: true } }),
    client.plan.findUnique({ where: { id: input.planId }, select: { actif: true } }),
  ]);
  if (!agence) return failure("Agence introuvable.");
  if (!plan) return failure("Plan introuvable.", "planId");
  if (!plan.actif)
    return failure("Ce plan est désactivé : il ne peut plus être attribué.", "planId");
  const today = calendarDate(now);
  await client.$transaction(async (tx) => {
    await tx.abonnement.updateMany({
      where: { agenceId: agence.id, statut: { in: ["ESSAI", "ACTIF"] } },
      data: { statut: "ANNULE", dateFin: today },
    });
    await tx.abonnement.create({
      data: {
        agenceId: agence.id,
        planId: input.planId,
        statut: input.statut,
        dateDebut: today,
        dateFin: input.duree === "illimitee" ? null : subscriptionEnd(today, Number(input.duree)),
        renouvellementAuto: false,
      },
    });
  });
  return success(undefined);
}

/* ─── Plans ──────────────────────────────────────────────────────────────────── */

export function listPlans(client: PrismaClient = getAdminDb()) {
  return client.plan.findMany({
    orderBy: [{ actif: "desc" }, { prixMensuel: "asc" }],
    select: {
      id: true,
      code: true,
      nom: true,
      prixMensuel: true,
      maxCircuits: true,
      maxUtilisateurs: true,
      maxSessionsActives: true,
      fonctionnalites: true,
      actif: true,
      _count: { select: { abonnements: true } },
    },
  });
}

/** Plans proposés au public (page Tarifs) et à l'attribution : les plans actifs. */
export function listActivePlans(client: PrismaClient = getAdminDb()) {
  return client.plan.findMany({
    where: { actif: true },
    orderBy: { prixMensuel: "asc" },
    select: {
      id: true,
      code: true,
      nom: true,
      prixMensuel: true,
      maxCircuits: true,
      maxUtilisateurs: true,
      maxSessionsActives: true,
      fonctionnalites: true,
    },
  });
}

/** Fonctionnalités d'un plan (colonne JSON) sous forme de liste de textes. */
export function planFeatures(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

const CODE_TAKEN = "Ce code est déjà utilisé par un autre plan.";

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createPlan(
  input: PlanInput,
  client: PrismaClient = getAdminDb(),
): Promise<ServiceResult> {
  try {
    await client.plan.create({ data: { ...input, actif: true } });
    return success(undefined);
  } catch (error: unknown) {
    if (isUniqueViolation(error)) return failure(CODE_TAKEN, "code");
    throw error;
  }
}

export async function updatePlan(
  id: string,
  input: PlanInput,
  client: PrismaClient = getAdminDb(),
): Promise<ServiceResult> {
  try {
    const result = await client.plan.updateMany({ where: { id }, data: input });
    return result.count === 1 ? success(undefined) : failure("Plan introuvable.");
  } catch (error: unknown) {
    if (isUniqueViolation(error)) return failure(CODE_TAKEN, "code");
    throw error;
  }
}

/** Décision E : pas de suppression d'un plan utilisé ; désactivé, il n'est plus proposé. */
export async function setPlanActif(
  id: string,
  actif: boolean,
  client: PrismaClient = getAdminDb(),
): Promise<ServiceResult> {
  const result = await client.plan.updateMany({ where: { id }, data: { actif } });
  return result.count === 1 ? success(undefined) : failure("Plan introuvable.");
}
