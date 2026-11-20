import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { getAdminDb } from "@/lib/admin-db";
import { type Paginated, pageArgs, pageCount } from "@/lib/pagination";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import { nomPublic } from "@/lib/services/voyageurs";
import { type FeedFilters, photosJsonSchema, PHOTOS_MAX } from "@/lib/validators/communaute";

/**
 * Communauté des voyageurs (étape 5d, choix de l'étudiant) : un fil COMMUN à toutes les
 * agences, où un voyageur publie les photos d'un séjour terminé ; « J'aime », commentaires,
 * signalement. Modération par le super admin.
 *
 * Isolation : les tables de la communauté sont des tables de la PLATEFORME (portée
 * « platform » du helper tenant, interdite au client d'une agence). Ce service utilise donc le
 * client non confiné, comme la console du super admin, mais n'agit jamais qu'au nom du
 * voyageur connecté (`viewerId`, relu par la session) : sa réservation, ses publications, ses
 * commentaires. Une agence ne lit ni n'écrit rien ici.
 *
 * Ce qui est montré d'un voyageur : prénom, initiale, photo, nom de l'agence du séjour.
 */

export const FEED_PAGE_SIZE = 10;
/** Garde-fous contre l'envoi en masse. */
export const PUBLICATIONS_PAR_JOUR = 10;
export const COMMENTAIRES_PAR_HEURE = 30;

type Db = PrismaClient;

/** Contenu visible : non masqué, auteur actif, agence active (RG 19). */
const auteurVisible = { actif: true, agence: { statut: "ACTIVE" } } as const;
const publicationVisible = {
  statut: "VISIBLE",
  auteur: auteurVisible,
} satisfies Prisma.PublicationWhereInput;

const personne = { select: { id: true, prenom: true, nom: true, photoUrl: true } } as const;

const publicationSelect = (viewerId: string) =>
  ({
    id: true,
    legende: true,
    photos: true,
    createdAt: true,
    auteur: personne,
    reservation: {
      select: {
        agence: { select: { nom: true, slug: true } },
        session: {
          select: { circuit: { select: { id: true, titre: true, slug: true, statut: true } } },
        },
      },
    },
    jaimes: { where: { utilisateurId: viewerId }, select: { utilisateurId: true } },
    _count: {
      select: {
        jaimes: true,
        commentaires: { where: { statut: "VISIBLE", auteur: auteurVisible } },
      },
    },
  }) satisfies Prisma.PublicationSelect;

type PublicationRow = Prisma.PublicationGetPayload<{
  select: ReturnType<typeof publicationSelect>;
}>;

/** Photos d'une publication : seulement des adresses de l'application (JSON vérifié). */
export function readPhotos(value: unknown): string[] {
  const parsed = photosJsonSchema.safeParse(value);
  return parsed.success ? parsed.data.slice(0, PHOTOS_MAX) : [];
}

function toCard(row: PublicationRow, viewerId: string) {
  const circuit = row.reservation.session.circuit;
  return {
    id: row.id,
    legende: row.legende,
    photos: readPhotos(row.photos),
    createdAt: row.createdAt,
    auteur: { id: row.auteur.id, nom: nomPublic(row.auteur), photo: row.auteur.photoUrl },
    agence: row.reservation.agence,
    // Lien vers la fiche du circuit seulement s'il est encore publié (RG 9).
    circuit: {
      id: circuit.id,
      titre: circuit.titre,
      slug: circuit.statut === "PUBLIE" ? circuit.slug : null,
    },
    jaimes: row._count.jaimes,
    jAime: row.jaimes.length > 0,
    commentaires: row._count.commentaires,
    deMoi: row.auteur.id === viewerId,
  };
}

export type PublicationCard = ReturnType<typeof toCard>;

/** Conditions du fil : contenu visible, destination (circuit), recherche. */
function feedWhere(viewerId: string, filters: Partial<FeedFilters>): Prisma.PublicationWhereInput {
  const and: Prisma.PublicationWhereInput[] = [publicationVisible];
  if (filters.moi) and.push({ auteurId: viewerId });
  if (filters.circuit) and.push({ reservation: { session: { circuitId: filters.circuit } } });
  if (filters.q) {
    and.push({
      OR: [
        { legende: { contains: filters.q } },
        { reservation: { session: { circuit: { titre: { contains: filters.q } } } } },
        { reservation: { agence: { nom: { contains: filters.q } } } },
      ],
    });
  }
  return { AND: and };
}

/**
 * Fil de la communauté : « Récentes » (la plus récente d'abord) ou « Populaires » (le plus de
 * « J'aime », puis la plus récente) ; filtrable par destination et par recherche.
 */
export async function listFeed(
  viewerId: string,
  page: number,
  db: Db = getAdminDb(),
  filters: Partial<FeedFilters> = {},
): Promise<Paginated<PublicationCard>> {
  const where = feedWhere(viewerId, filters);
  const orderBy: Prisma.PublicationOrderByWithRelationInput[] =
    filters.tri === "populaires"
      ? [{ jaimes: { _count: "desc" } }, { createdAt: "desc" }, { id: "desc" }]
      : [{ createdAt: "desc" }, { id: "desc" }];
  const [rows, total] = await Promise.all([
    db.publication.findMany({
      where,
      orderBy,
      select: publicationSelect(viewerId),
      ...pageArgs(page, FEED_PAGE_SIZE),
    }),
    db.publication.count({ where }),
  ]);
  return {
    items: rows.map((r) => toCard(r, viewerId)),
    total,
    page,
    pageCount: pageCount(total, FEED_PAGE_SIZE),
  };
}

/**
 * Destinations de la communauté (rangée de vignettes) : les circuits qui ont des
 * publications visibles, les plus partagés d'abord, avec la première photo de la plus récente.
 */
export async function listDestinations(limit = 12, db: Db = getAdminDb()) {
  const groups = await db.publication.findMany({
    where: publicationVisible,
    orderBy: { createdAt: "desc" },
    select: {
      photos: true,
      reservation: {
        select: {
          agence: { select: { nom: true } },
          session: { select: { circuit: { select: { id: true, titre: true } } } },
        },
      },
    },
    take: 500,
  });
  const byCircuit = new Map<
    string,
    { id: string; titre: string; agence: string; photo: string | null; publications: number }
  >();
  for (const g of groups) {
    const c = g.reservation.session.circuit;
    const current = byCircuit.get(c.id);
    if (current) current.publications += 1;
    else {
      byCircuit.set(c.id, {
        id: c.id,
        titre: c.titre,
        agence: g.reservation.agence.nom,
        photo: readPhotos(g.photos)[0] ?? null,
        publications: 1,
      });
    }
  }
  return [...byCircuit.values()].sort((a, b) => b.publications - a.publications).slice(0, limit);
}

export type Destination = Awaited<ReturnType<typeof listDestinations>>[number];

/** Chiffres de la carte de profil : mes publications, « J'aime » et commentaires reçus. */
export async function myCommunityStats(viewerId: string, db: Db = getAdminDb()) {
  const mine = { auteurId: viewerId, statut: "VISIBLE" } as const;
  const [publications, jaimes, commentaires] = await Promise.all([
    db.publication.count({ where: mine }),
    db.jaime.count({ where: { publication: mine } }),
    db.commentaire.count({
      where: { publication: mine, statut: "VISIBLE", auteurId: { not: viewerId } },
    }),
  ]);
  return { publications, jaimes, commentaires };
}

/** Activité de toute la communauté (carte de la colonne de droite). */
export async function communityActivity(db: Db = getAdminDb()) {
  const [publications, auteurs, agences] = await Promise.all([
    db.publication.count({ where: publicationVisible }),
    db.publication.groupBy({ by: ["auteurId"], where: publicationVisible }),
    db.agence.count({
      where: {
        statut: "ACTIVE",
        reservations: { some: { publications: { some: publicationVisible } } },
      },
    }),
  ]);
  return { publications, voyageurs: auteurs.length, agences };
}

/** Une publication et ses commentaires visibles (null si absente ou masquée). */
export async function getPublication(viewerId: string, id: string, db: Db = getAdminDb()) {
  const row = await db.publication.findFirst({
    where: { id, ...publicationVisible },
    select: {
      ...publicationSelect(viewerId),
      commentaires: {
        where: { statut: "VISIBLE", auteur: auteurVisible },
        orderBy: { createdAt: "asc" },
        select: { id: true, contenu: true, createdAt: true, auteur: personne },
      },
    },
  });
  if (!row) return null;
  return {
    ...toCard(row, viewerId),
    listeCommentaires: row.commentaires.map((c) => ({
      id: c.id,
      contenu: c.contenu,
      createdAt: c.createdAt,
      auteur: { id: c.auteur.id, nom: nomPublic(c.auteur), photo: c.auteur.photoUrl },
      deMoi: c.auteur.id === viewerId,
    })),
  };
}

export type PublicationDetail = NonNullable<Awaited<ReturnType<typeof getPublication>>>;

/** Séjours terminés du voyageur : ceux dont il peut partager les photos. */
export async function listSejoursPartageables(viewerId: string, db: Db = getAdminDb()) {
  const rows = await db.reservation.findMany({
    where: { clientId: viewerId, statut: "TERMINEE" },
    orderBy: { session: { dateDebut: "desc" } },
    select: {
      id: true,
      reference: true,
      session: {
        select: { dateDebut: true, dateFin: true, circuit: { select: { titre: true } } },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    circuit: r.session.circuit.titre,
    dateDebut: r.session.dateDebut,
    dateFin: r.session.dateFin,
  }));
}

/**
 * Nouvelle publication : 1 à 4 photos (déjà enregistrées) et une légende, pour un séjour
 * TERMINÉ du voyageur (même règle que les avis, RG 17).
 */
export async function createPublication(
  viewerId: string,
  input: { reservationId: string; legende: string | null; photos: string[] },
  now: Date = new Date(),
  db: Db = getAdminDb(),
): Promise<ServiceResult<{ id: string }>> {
  if (input.photos.length === 0) return failure("Ajoutez au moins une photo.", "photos");
  if (input.photos.length > PHOTOS_MAX) {
    return failure(`${PHOTOS_MAX} photos au maximum.`, "photos");
  }
  const reservation = await db.reservation.findFirst({
    where: { id: input.reservationId, clientId: viewerId },
    select: { statut: true },
  });
  if (!reservation) return failure("Séjour introuvable.", "reservationId");
  if (reservation.statut !== "TERMINEE") {
    return failure("Vous pourrez partager vos photos une fois le séjour terminé.", "reservationId");
  }
  const recentes = await db.publication.count({
    where: { auteurId: viewerId, createdAt: { gte: new Date(now.getTime() - 86_400_000) } },
  });
  if (recentes >= PUBLICATIONS_PAR_JOUR) {
    return failure("Vous avez beaucoup publié aujourd'hui : réessayez demain.");
  }
  const created = await db.publication.create({
    data: {
      auteurId: viewerId,
      reservationId: input.reservationId,
      legende: input.legende,
      photos: input.photos,
      createdAt: now,
    },
    select: { id: true },
  });
  return success(created);
}

/** Suppression de SA publication ; renvoie les photos à effacer du disque. */
export async function deletePublication(
  viewerId: string,
  id: string,
  db: Db = getAdminDb(),
): Promise<ServiceResult<{ photos: string[] }>> {
  const row = await db.publication.findFirst({
    where: { id, auteurId: viewerId },
    select: { photos: true },
  });
  if (!row) return failure("Publication introuvable.");
  await db.$transaction([
    db.signalementCommunaute.deleteMany({ where: { cible: "PUBLICATION", cibleId: id } }),
    db.publication.delete({ where: { id } }),
  ]);
  return success({ photos: readPhotos(row.photos) });
}

/** « J'aime » ou retrait, sur une publication visible ; renvoie le nouveau total. */
export async function setJaime(
  viewerId: string,
  publicationId: string,
  jaime: boolean,
  db: Db = getAdminDb(),
): Promise<ServiceResult<{ jaimes: number }>> {
  const visible = await db.publication.count({
    where: { id: publicationId, ...publicationVisible },
  });
  if (!visible) return failure("Publication introuvable.");
  if (jaime) {
    await db.jaime.upsert({
      where: { publicationId_utilisateurId: { publicationId, utilisateurId: viewerId } },
      create: { publicationId, utilisateurId: viewerId },
      update: {},
    });
  } else {
    await db.jaime.deleteMany({ where: { publicationId, utilisateurId: viewerId } });
  }
  return success({ jaimes: await db.jaime.count({ where: { publicationId } }) });
}

export async function addCommentaire(
  viewerId: string,
  input: { publicationId: string; contenu: string },
  now: Date = new Date(),
  db: Db = getAdminDb(),
): Promise<ServiceResult<{ id: string }>> {
  const visible = await db.publication.count({
    where: { id: input.publicationId, ...publicationVisible },
  });
  if (!visible) return failure("Publication introuvable.");
  const recents = await db.commentaire.count({
    where: { auteurId: viewerId, createdAt: { gte: new Date(now.getTime() - 3_600_000) } },
  });
  if (recents >= COMMENTAIRES_PAR_HEURE) {
    return failure("Beaucoup de commentaires en peu de temps : réessayez dans un moment.");
  }
  const created = await db.commentaire.create({
    data: {
      publicationId: input.publicationId,
      auteurId: viewerId,
      contenu: input.contenu,
      createdAt: now,
    },
    select: { id: true },
  });
  return success(created);
}

/** Suppression de SON commentaire. */
export async function deleteCommentaire(
  viewerId: string,
  id: string,
  db: Db = getAdminDb(),
): Promise<ServiceResult> {
  const { count } = await db.commentaire.deleteMany({ where: { id, auteurId: viewerId } });
  if (count === 0) return failure("Commentaire introuvable.");
  await db.signalementCommunaute.deleteMany({ where: { cible: "COMMENTAIRE", cibleId: id } });
  return success(undefined);
}

/** Auteur d'un contenu visible de la communauté (null si absent ou masqué). */
async function contentAuthor(
  db: Db,
  cible: "PUBLICATION" | "COMMENTAIRE",
  cibleId: string,
): Promise<string | null> {
  if (cible === "PUBLICATION") {
    const p = await db.publication.findFirst({
      where: { id: cibleId, ...publicationVisible },
      select: { auteurId: true },
    });
    return p?.auteurId ?? null;
  }
  const c = await db.commentaire.findFirst({
    where: {
      id: cibleId,
      statut: "VISIBLE",
      auteur: auteurVisible,
      publication: publicationVisible,
    },
    select: { auteurId: true },
  });
  return c?.auteurId ?? null;
}

/** Signalement d'une publication ou d'un commentaire d'un autre voyageur (super admin). */
export async function reportContent(
  viewerId: string,
  input: { cible: "PUBLICATION" | "COMMENTAIRE"; cibleId: string; motif: string | null },
  db: Db = getAdminDb(),
): Promise<ServiceResult> {
  const auteurId = await contentAuthor(db, input.cible, input.cibleId);
  if (!auteurId) return failure("Contenu introuvable.");
  if (auteurId === viewerId) return failure("Vous ne pouvez pas signaler votre propre contenu.");
  const deja = await db.signalementCommunaute.count({
    where: { auteurId: viewerId, cible: input.cible, cibleId: input.cibleId },
  });
  if (deja) return failure("Vous avez déjà signalé ce contenu.");
  await db.signalementCommunaute.create({
    data: { auteurId: viewerId, cible: input.cible, cibleId: input.cibleId, motif: input.motif },
  });
  return success(undefined);
}

/* ─── Modération (super admin, après vérification du rôle) ───────────────────────── */

export async function countOpenReports(db: Db = getAdminDb()): Promise<number> {
  return db.signalementCommunaute.count({ where: { statut: "OUVERT" } });
}

/** Signalements avec le contenu visé (publication ou commentaire), y compris s'il est masqué. */
export async function listCommunityReports(
  statut: "OUVERT" | "TRAITE" | undefined,
  page: number,
  db: Db = getAdminDb(),
) {
  const where: Prisma.SignalementCommunauteWhereInput = statut ? { statut } : {};
  const [rows, total] = await Promise.all([
    db.signalementCommunaute.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        cible: true,
        cibleId: true,
        motif: true,
        statut: true,
        createdAt: true,
        auteur: { select: { prenom: true, nom: true } },
      },
      ...pageArgs(page),
    }),
    db.signalementCommunaute.count({ where }),
  ]);
  const ids = (cible: string) => rows.filter((r) => r.cible === cible).map((r) => r.cibleId);
  const auteurComplet = {
    select: { prenom: true, nom: true, agence: { select: { nom: true } } },
  } as const;
  const [publications, commentaires] = await Promise.all([
    db.publication.findMany({
      where: { id: { in: ids("PUBLICATION") } },
      select: { id: true, legende: true, photos: true, statut: true, auteur: auteurComplet },
    }),
    db.commentaire.findMany({
      where: { id: { in: ids("COMMENTAIRE") } },
      select: { id: true, contenu: true, statut: true, auteur: auteurComplet },
    }),
  ]);
  const pubs = new Map(publications.map((p) => [p.id, p]));
  const coms = new Map(commentaires.map((c) => [c.id, c]));
  const auteurDe = (a: { prenom: string; nom: string; agence: { nom: string } | null }) =>
    `${a.prenom} ${a.nom}${a.agence ? ` (${a.agence.nom})` : ""}`;
  return {
    items: rows.map((r) => {
      const p = r.cible === "PUBLICATION" ? pubs.get(r.cibleId) : undefined;
      const c = r.cible === "COMMENTAIRE" ? coms.get(r.cibleId) : undefined;
      const contenu = p
        ? {
            texte: p.legende,
            photos: readPhotos(p.photos),
            statut: p.statut,
            auteur: auteurDe(p.auteur),
          }
        : c
          ? { texte: c.contenu, photos: [], statut: c.statut, auteur: auteurDe(c.auteur) }
          : null;
      return {
        id: r.id,
        cible: r.cible,
        motif: r.motif,
        statut: r.statut,
        createdAt: r.createdAt,
        signalePar: nomPublic(r.auteur),
        contenu,
      };
    }),
    total,
    page,
    pageCount: pageCount(total),
  };
}

/** Contenu signalé masqué, et tous les signalements qui le visent traités. */
export async function hideReportedContent(
  signalementId: string,
  now: Date = new Date(),
  db: Db = getAdminDb(),
): Promise<ServiceResult> {
  const s = await db.signalementCommunaute.findUnique({
    where: { id: signalementId },
    select: { cible: true, cibleId: true },
  });
  if (!s) return failure("Signalement introuvable.");
  await db.$transaction([
    s.cible === "PUBLICATION"
      ? db.publication.updateMany({
          where: { id: s.cibleId },
          data: { statut: "MASQUE", masqueAt: now },
        })
      : db.commentaire.updateMany({ where: { id: s.cibleId }, data: { statut: "MASQUE" } }),
    db.signalementCommunaute.updateMany({
      where: { cible: s.cible, cibleId: s.cibleId, statut: "OUVERT" },
      data: { statut: "TRAITE", traiteAt: now },
    }),
  ]);
  return success(undefined);
}

/** Signalement classé sans suite (le contenu reste visible). */
export async function dismissReport(
  signalementId: string,
  now: Date = new Date(),
  db: Db = getAdminDb(),
): Promise<ServiceResult> {
  const { count } = await db.signalementCommunaute.updateMany({
    where: { id: signalementId, statut: "OUVERT" },
    data: { statut: "TRAITE", traiteAt: now },
  });
  return count === 1 ? success(undefined) : failure("Signalement introuvable ou déjà traité.");
}

/** Contenu masqué par erreur : de nouveau visible. */
export async function restoreReportedContent(
  signalementId: string,
  db: Db = getAdminDb(),
): Promise<ServiceResult> {
  const s = await db.signalementCommunaute.findUnique({
    where: { id: signalementId },
    select: { cible: true, cibleId: true },
  });
  if (!s) return failure("Signalement introuvable.");
  if (s.cible === "PUBLICATION") {
    await db.publication.updateMany({
      where: { id: s.cibleId },
      data: { statut: "VISIBLE", masqueAt: null },
    });
  } else {
    await db.commentaire.updateMany({ where: { id: s.cibleId }, data: { statut: "VISIBLE" } });
  }
  return success(undefined);
}
