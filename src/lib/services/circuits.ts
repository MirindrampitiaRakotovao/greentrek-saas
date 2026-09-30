import { Prisma, type StatutCircuit } from "@/generated/prisma/client";
import { type Paginated, pageArgs, pageCount } from "@/lib/pagination";
import { checkPlanLimit } from "@/lib/services/abonnements";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import type { TenantDb, TenantTx } from "@/lib/tenant";
import type {
  AddCircuitEtapeInput,
  CircuitInput,
  CircuitPartenaireInput,
  UpdateCircuitEtapeInput,
} from "@/lib/validators/circuits";

/**
 * Circuits de l'agence et leurs étapes ordonnées (§7.3, RG 4, RG 9).
 *
 * - RG 4 : un circuit est composé d'au moins deux étapes, ordonnées sans doublon de rang.
 *   Le rang est géré ici : ajout en fin de liste, déplacement par échange avec la voisine,
 *   renumérotation après un retrait. Les rangs restent donc 1, 2, …, n sans trou.
 *   La publication exige au moins deux étapes, et un circuit publié ne peut pas descendre
 *   sous ce seuil.
 * - RG 9 : seul un circuit PUBLIE est visible publiquement (site vitrine, étape E8).
 */

export const MIN_ETAPES_PUBLICATION = 2;

const circuitListSelect = {
  id: true,
  titre: true,
  slug: true,
  resume: true,
  difficulte: true,
  dureeJours: true,
  prixParPersonne: true,
  capaciteMax: true,
  imagePrincipaleUrl: true,
  statut: true,
  _count: { select: { etapes: true, sessionsDepart: true, partenaires: true } },
} satisfies Prisma.CircuitSelect;

export type CircuitRow = Prisma.CircuitGetPayload<{ select: typeof circuitListSelect }>;

export async function listCircuits(db: TenantDb, page: number): Promise<Paginated<CircuitRow>> {
  const [items, total] = await Promise.all([
    db.circuit.findMany({
      select: circuitListSelect,
      // Publiés d'abord, puis brouillons, puis archivés (ordre de l'énumération).
      orderBy: [{ statut: "asc" }, { titre: "asc" }],
      ...pageArgs(page),
    }),
    db.circuit.count(),
  ]);
  return { items, total, page, pageCount: pageCount(total) };
}

const circuitDetailSelect = {
  ...circuitListSelect,
  description: true,
  etapes: {
    orderBy: { ordre: "asc" },
    select: {
      id: true,
      ordre: true,
      jour: true,
      dureeSejourMin: true,
      notes: true,
      etape: { select: { id: true, nom: true, type: true, latitude: true, longitude: true } },
    },
  },
  partenaires: {
    orderBy: { partenaire: { nom: "asc" } },
    select: {
      id: true,
      prestation: true,
      prixUnitaire: true,
      inclusDansPrix: true,
      partenaire: { select: { id: true, nom: true, type: true } },
      etape: { select: { id: true, nom: true } },
    },
  },
} satisfies Prisma.CircuitSelect;

export type CircuitDetail = Prisma.CircuitGetPayload<{ select: typeof circuitDetailSelect }>;

export function getCircuit(db: TenantDb, id: string): Promise<CircuitDetail | null> {
  return db.circuit.findUnique({ where: { id }, select: circuitDetailSelect });
}

const SLUG_TAKEN = "Cet identifiant est déjà utilisé par un autre circuit de l'agence.";

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createCircuit(
  db: TenantDb,
  agenceId: string,
  input: CircuitInput,
): Promise<ServiceResult<{ id: string }>> {
  if (await db.circuit.findFirst({ where: { slug: input.slug }, select: { id: true } })) {
    return failure(SLUG_TAKEN, "slug");
  }
  const limite = await checkPlanLimit(db, "circuits"); // RG 18
  if (limite) return limite;
  try {
    // Un nouveau circuit est un brouillon : il n'a pas encore d'étapes (RG 4).
    const created = await db.circuit.create({ data: { ...input, agenceId, statut: "BROUILLON" } });
    return success({ id: created.id });
  } catch (error: unknown) {
    if (isUniqueViolation(error)) return failure(SLUG_TAKEN, "slug");
    throw error;
  }
}

export async function updateCircuit(
  db: TenantDb,
  id: string,
  input: CircuitInput,
): Promise<ServiceResult> {
  const duplicate = await db.circuit.findFirst({
    where: { slug: input.slug, id: { not: id } },
    select: { id: true },
  });
  if (duplicate) return failure(SLUG_TAKEN, "slug");
  try {
    const result = await db.circuit.updateMany({ where: { id }, data: input });
    return result.count === 1 ? success(undefined) : failure("Circuit introuvable.");
  } catch (error: unknown) {
    if (isUniqueViolation(error)) return failure(SLUG_TAKEN, "slug");
    throw error;
  }
}

/** Publication, retour en brouillon ou archivage (RG 4 pour la publication). */
export async function setCircuitStatut(
  db: TenantDb,
  id: string,
  statut: StatutCircuit,
): Promise<ServiceResult> {
  const circuit = await db.circuit.findUnique({
    where: { id },
    select: { statut: true, _count: { select: { etapes: true } } },
  });
  if (!circuit) return failure("Circuit introuvable.");
  if (circuit.statut === "ARCHIVE" && statut !== "ARCHIVE") {
    // Un circuit sorti des archives compte de nouveau dans la limite du plan (RG 18).
    const limite = await checkPlanLimit(db, "circuits");
    if (limite) return limite;
  }
  if (statut === "PUBLIE" && circuit._count.etapes < MIN_ETAPES_PUBLICATION) {
    return failure(
      `Publication impossible : un circuit doit comporter au moins ${MIN_ETAPES_PUBLICATION} étapes (RG 4).`,
    );
  }
  await db.circuit.update({ where: { id }, data: { statut } });
  return success(undefined);
}

/** Suppression définitive, seulement si aucun départ n'a été programmé (sinon : archiver). */
export async function deleteCircuit(db: TenantDb, id: string): Promise<ServiceResult> {
  const circuit = await db.circuit.findUnique({
    where: { id },
    select: { _count: { select: { sessionsDepart: true, avis: true } } },
  });
  if (!circuit) return failure("Circuit introuvable.");
  if (circuit._count.sessionsDepart > 0 || circuit._count.avis > 0) {
    return failure("Ce circuit a déjà des départs : archivez-le plutôt que de le supprimer.");
  }
  // Les étapes ordonnées et les prestations partenaires suivent (ON DELETE CASCADE).
  await db.circuit.delete({ where: { id } });
  return success(undefined);
}

/* ─── Étapes du circuit ──────────────────────────────────────────────────────── */

async function lastRang(tx: TenantTx, circuitId: string): Promise<number> {
  const last = await tx.circuitEtape.findFirst({
    where: { circuitId },
    orderBy: { ordre: "desc" },
    select: { ordre: true, etapeId: true },
  });
  return last?.ordre ?? 0;
}

/** Ajoute une étape en fin de circuit. */
export async function addCircuitEtape(
  db: TenantDb,
  input: AddCircuitEtapeInput,
): Promise<ServiceResult> {
  return db.$tenantTransaction(async (tx) => {
    const circuit = await tx.circuit.findUnique({
      where: { id: input.circuitId },
      select: { id: true },
    });
    if (!circuit) return failure("Circuit introuvable.");
    const last = await tx.circuitEtape.findFirst({
      where: { circuitId: input.circuitId },
      orderBy: { ordre: "desc" },
      select: { ordre: true, etapeId: true },
    });
    if (last?.etapeId === input.etapeId) {
      return failure("Cette étape est déjà la dernière du circuit.", "etapeId");
    }
    // Le helper tenant vérifie que l'étape appartient bien à l'agence.
    await tx.circuitEtape.create({ data: { ...input, ordre: (last?.ordre ?? 0) + 1 } });
    return success(undefined);
  });
}

export async function updateCircuitEtape(
  db: TenantDb,
  input: UpdateCircuitEtapeInput,
): Promise<ServiceResult> {
  const { id, ...data } = input;
  const result = await db.circuitEtape.updateMany({ where: { id }, data });
  return result.count === 1 ? success(undefined) : failure("Étape du circuit introuvable.");
}

/**
 * Échange le rang d'une étape avec sa voisine. L'index unique (circuitId, ordre) interdit
 * deux étapes au même rang, même un instant : on passe par un rang temporaire libre.
 */
export async function moveCircuitEtape(
  db: TenantDb,
  id: string,
  direction: "up" | "down",
): Promise<ServiceResult> {
  return db.$tenantTransaction(async (tx) => {
    const current = await tx.circuitEtape.findUnique({
      where: { id },
      select: { id: true, circuitId: true, ordre: true },
    });
    if (!current) return failure("Étape du circuit introuvable.");
    const neighbour = await tx.circuitEtape.findFirst({
      where: {
        circuitId: current.circuitId,
        ordre: direction === "up" ? { lt: current.ordre } : { gt: current.ordre },
      },
      orderBy: { ordre: direction === "up" ? "desc" : "asc" },
      select: { id: true, ordre: true },
    });
    if (!neighbour) return success(undefined); // déjà en tête (ou en fin) de liste
    const temporaire = (await lastRang(tx, current.circuitId)) + 1;
    await tx.circuitEtape.update({ where: { id: current.id }, data: { ordre: temporaire } });
    await tx.circuitEtape.update({ where: { id: neighbour.id }, data: { ordre: current.ordre } });
    await tx.circuitEtape.update({ where: { id: current.id }, data: { ordre: neighbour.ordre } });
    return success(undefined);
  });
}

/** Retire une étape puis renumérote les suivantes (rangs sans trou). */
export async function removeCircuitEtape(db: TenantDb, id: string): Promise<ServiceResult> {
  return db.$tenantTransaction(async (tx) => {
    const current = await tx.circuitEtape.findUnique({
      where: { id },
      select: {
        id: true,
        circuitId: true,
        ordre: true,
        circuit: { select: { statut: true, _count: { select: { etapes: true } } } },
      },
    });
    if (!current) return failure("Étape du circuit introuvable.");
    if (
      current.circuit.statut === "PUBLIE" &&
      current.circuit._count.etapes <= MIN_ETAPES_PUBLICATION
    ) {
      return failure(
        `Un circuit publié doit garder au moins ${MIN_ETAPES_PUBLICATION} étapes (RG 4) : repassez-le en brouillon d'abord.`,
      );
    }
    await tx.circuitEtape.delete({ where: { id } });
    const suivantes = await tx.circuitEtape.findMany({
      where: { circuitId: current.circuitId, ordre: { gt: current.ordre } },
      orderBy: { ordre: "asc" },
      select: { id: true, ordre: true },
    });
    // Ordre croissant : chaque rang visé vient d'être libéré, pas de collision.
    for (const etape of suivantes) {
      await tx.circuitEtape.update({ where: { id: etape.id }, data: { ordre: etape.ordre - 1 } });
    }
    return success(undefined);
  });
}

/* ─── Partenaires inclus ─────────────────────────────────────────────────────── */

export async function addCircuitPartenaire(
  db: TenantDb,
  input: CircuitPartenaireInput,
): Promise<ServiceResult> {
  const circuit = await db.circuit.findUnique({
    where: { id: input.circuitId },
    select: { id: true },
  });
  if (!circuit) return failure("Circuit introuvable.");
  // Le helper tenant vérifie que partenaire et étape appartiennent à l'agence.
  await db.circuitPartenaire.create({ data: input });
  return success(undefined);
}

export async function removeCircuitPartenaire(db: TenantDb, id: string): Promise<ServiceResult> {
  const result = await db.circuitPartenaire.deleteMany({ where: { id } });
  return result.count === 1 ? success(undefined) : failure("Prestation introuvable.");
}
