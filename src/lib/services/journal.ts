import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { type Paginated, pageArgs, pageCount } from "@/lib/pagination";
import type { TenantDb } from "@/lib/tenant";

/**
 * Journal d'activité (§5.2 table 19, §7.6, P2, étape E12) : trace des actions sensibles
 * (qui, quoi, sur quel objet, quand). Aucune donnée sensible dans les détails (§12 : ni mot
 * de passe, ni numéro de paiement).
 */

export type ActivityInput = {
  utilisateurId: string | null;
  /** Code de l'action, ex. « RESERVATION_ANNULEE ». */
  action: string;
  entite: string;
  entiteId?: string | null;
  details?: Prisma.InputJsonValue;
};

export const ACTION_LABELS: Record<string, string> = {
  RESERVATION_CONFIRMEE: "Réservation confirmée",
  RESERVATION_ANNULEE: "Réservation annulée",
  PAIEMENT_ENREGISTRE: "Paiement enregistré",
  PAIEMENT_VALIDE: "Paiement validé",
  PAIEMENT_REFUSE: "Paiement refusé",
  PAIEMENT_REMBOURSE: "Paiement remboursé",
  DEPART_ANNULE: "Départ annulé",
  CIRCUIT_STATUT: "Statut d'un circuit modifié",
  AVIS_MODERE: "Avis modéré",
  MEMBRE_AJOUTE: "Membre ajouté",
  MEMBRE_ACTIVATION: "Compte activé ou désactivé",
  AGENCE_PARAMETRES: "Paramètres de l'agence modifiés",
  AGENCE_STATUT: "Agence suspendue ou réactivée",
  PLAN_ATTRIBUE: "Plan attribué",
  PLAN_MODIFIE: "Plan créé ou modifié",
};

/** Trace une action de l'agence (client confiné : l'agence est ajoutée automatiquement). */
export async function logAgencyActivity(
  db: TenantDb,
  agenceId: string,
  input: ActivityInput,
): Promise<void> {
  await db.journalActivite.create({ data: { ...input, agenceId } });
}

/** Trace une action de la plateforme (super admin) ; `agenceId` = agence concernée. */
export async function logPlatformActivity(
  client: PrismaClient,
  agenceId: string | null,
  input: ActivityInput,
): Promise<void> {
  await client.journalActivite.create({ data: { ...input, agenceId } });
}

const journalSelect = {
  id: true,
  action: true,
  entite: true,
  entiteId: true,
  details: true,
  createdAt: true,
  utilisateur: { select: { prenom: true, nom: true } },
  agence: { select: { nom: true } },
} satisfies Prisma.JournalActiviteSelect;

export type JournalRow = Prisma.JournalActiviteGetPayload<{ select: typeof journalSelect }>;

/**
 * Entrées du journal, les plus récentes d'abord. Client confiné : celles de l'agence ;
 * console plateforme : `where` restreint aux actions du super admin.
 */
export async function listJournal(
  db: TenantDb | PrismaClient,
  page: number,
  where: Prisma.JournalActiviteWhereInput = {},
): Promise<Paginated<JournalRow>> {
  const [items, total] = await Promise.all([
    db.journalActivite.findMany({
      where,
      select: journalSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageArgs(page),
    }),
    db.journalActivite.count({ where }),
  ]);
  return { items, total, page, pageCount: pageCount(total) };
}
