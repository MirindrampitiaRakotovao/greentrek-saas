import { Prisma, type Role } from "@/generated/prisma/client";
import {
  deliveryStatus,
  isUnreadIn,
  messagingSide,
  otherSideRoles,
  privateDeliveryStatus,
} from "@/lib/messagerie";
import { publish } from "@/lib/realtime/bus";
import { pushToDevices } from "@/lib/services/appareils";
import { excerpt } from "@/lib/realtime/events";
import { type Paginated, pageArgs, pageCount } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import type { TenantDb, TenantTx } from "@/lib/tenant";

/**
 * Messagerie entre les voyageurs, l'agence et les guides (ajoutée après E12, hors cahier
 * des charges). Portée de chacun, vérifiée par CHAQUE lecture et écriture :
 * - administrateur et personnel : toutes les conversations de l'agence (boîte partagée) ;
 * - guide : les conversations des réservations de SES départs ;
 * - client : SES conversations.
 * Le filtre d'agence est ajouté par le client confiné (helper tenant), comme ailleurs.
 */

export type Viewer = { id: string; role: Role };

/** Conversations visibles par l'utilisateur (en plus du filtre d'agence). */
export function conversationAccess(viewer: Viewer): Prisma.ConversationWhereInput {
  switch (viewer.role) {
    // L'équipe et le guide ne voient jamais les conversations privées entre voyageurs.
    case "ADMIN_AGENCE":
    case "STAFF":
      return { type: "AGENCE" };
    case "GUIDE":
      return { type: "AGENCE", reservation: { session: { guide: { utilisateurId: viewer.id } } } };
    case "CLIENT":
      return { OR: [{ clientId: viewer.id }, { destinataireId: viewer.id }] };
    default:
      return { id: { in: [] } }; // aucune (le super admin n'a pas accès aux échanges privés)
  }
}

/** Réservations au sujet desquelles l'utilisateur peut ouvrir une conversation. */
function reservationAccess(viewer: Viewer): Prisma.ReservationWhereInput {
  switch (viewer.role) {
    case "ADMIN_AGENCE":
    case "STAFF":
      return {};
    case "GUIDE":
      return { session: { guide: { utilisateurId: viewer.id } } };
    case "CLIENT":
      return { clientId: viewer.id };
    default:
      return { id: { in: [] } };
  }
}

/** Dernière lecture de l'utilisateur : jusqu'à `now` (création ou mise à jour). */
async function markRead(
  db: TenantDb | TenantTx,
  conversationId: string,
  utilisateurId: string,
  now: Date,
) {
  await db.lectureConversation.upsert({
    where: { conversationId_utilisateurId: { conversationId, utilisateurId } },
    create: { conversationId, utilisateurId, luJusqua: now },
    update: { luJusqua: now },
  });
}

/**
 * Participants actifs d'une conversation : l'équipe de l'agence (comptes actifs), le client et
 * le guide du départ (s'il a un compte), avec leur rôle.
 */
async function participants(db: TenantDb | TenantTx, conversationId: string) {
  const [conversation, equipe] = await Promise.all([
    db.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: {
        sujet: true,
        type: true,
        clientId: true,
        destinataireId: true,
        reservation: {
          select: { session: { select: { guide: { select: { utilisateurId: true } } } } },
        },
      },
    }),
    db.utilisateur.findMany({
      where: { actif: true, role: { in: ["ADMIN_AGENCE", "STAFF"] } },
      select: { id: true, role: true },
    }),
  ]);
  // Conversation privée : les deux voyageurs seulement (l'équipe n'y a pas accès).
  if (conversation.type === "VOYAGEURS") {
    return {
      sujet: conversation.sujet,
      type: conversation.type,
      membres: [
        { id: conversation.clientId, role: "CLIENT" as Role },
        ...(conversation.destinataireId
          ? [{ id: conversation.destinataireId, role: "CLIENT" as Role }]
          : []),
      ],
    };
  }
  const guideId = conversation.reservation?.session.guide?.utilisateurId ?? null;
  return {
    sujet: conversation.sujet,
    type: conversation.type,
    membres: [
      { id: conversation.clientId, role: "CLIENT" as Role },
      ...equipe,
      ...(guideId ? [{ id: guideId, role: "GUIDE" as Role }] : []),
    ],
  };
}

/**
 * Diffuse un nouveau message en temps réel à tous les participants sauf l'auteur : l'équipe
 * de l'agence (comptes actifs), le client et le guide du départ (s'il a un compte). Envoi
 * après le commit (`publish`).
 */
async function publishMessage(
  db: TenantDb | TenantTx,
  conversationId: string,
  auteurId: string,
  contenu: string,
) {
  const [conversation, auteur] = await Promise.all([
    participants(db, conversationId),
    db.utilisateur.findUniqueOrThrow({
      where: { id: auteurId },
      select: { prenom: true, nom: true },
    }),
  ]);
  const destinataires = conversation.membres.map((m) => m.id).filter((id) => id !== auteurId);
  const event = {
    type: "message" as const,
    conversationId,
    sujet: conversation.sujet,
    auteur: `${auteur.prenom} ${auteur.nom.charAt(0)}.`,
    extrait: excerpt(contenu),
  };
  publish(destinataires, event);
  // Seuls les voyageurs ont l'application mobile : leurs téléphones sonnent (après le commit).
  await pushToDevices(db, destinataires, event);
}

async function appendMessage(
  db: TenantDb,
  viewer: Viewer,
  conversationId: string,
  contenu: string,
  now: Date,
): Promise<string> {
  return db.$tenantTransaction(async (tx) => {
    const message = await tx.message.create({
      data: { conversationId, auteurId: viewer.id, contenu, createdAt: now },
    });
    await tx.conversation.updateMany({
      where: { id: conversationId },
      data: { dernierMessageAt: now },
    });
    await markRead(tx, conversationId, viewer.id, now);
    await publishMessage(tx, conversationId, viewer.id, contenu);
    return message.id;
  });
}

export type SentMessage = { conversationId: string; messageId: string };

/** Envoi d'un message dans une conversation accessible à l'utilisateur. */
export async function sendMessage(
  db: TenantDb,
  viewer: Viewer,
  input: { conversationId: string; contenu: string },
  now: Date = new Date(),
): Promise<ServiceResult<SentMessage>> {
  if (!can(viewer.role, "creer", "message")) return failure("Messagerie non disponible.");
  const conversation = await db.conversation.findFirst({
    where: { id: input.conversationId, ...conversationAccess(viewer) },
    select: { id: true, type: true, clientId: true, destinataireId: true },
  });
  if (!conversation) return failure("Conversation introuvable.");
  if (conversation.type === "VOYAGEURS") {
    // Blocage dans un sens ou dans l'autre : plus aucun message (étape 5c).
    const autre =
      conversation.clientId === viewer.id ? conversation.destinataireId : conversation.clientId;
    if (autre && (await isBlockedBetween(db, viewer.id, autre))) {
      return failure("Vous ne pouvez plus écrire à ce voyageur.");
    }
  }
  const messageId = await appendMessage(db, viewer, conversation.id, input.contenu, now);
  return success({ conversationId: conversation.id, messageId });
}

/**
 * Nouvelle conversation. Au sujet d'une réservation (client titulaire, équipe de l'agence,
 * guide du départ) : au plus une conversation par réservation ; si elle existe déjà, le
 * message y est ajouté. Sans réservation : question générale, réservée au client.
 */
export async function startConversation(
  db: TenantDb,
  viewer: Viewer,
  input: { agenceId: string; reservationId: string | null; sujet: string | null; contenu: string },
  now: Date = new Date(),
): Promise<ServiceResult<SentMessage>> {
  if (!can(viewer.role, "creer", "message")) return failure("Messagerie non disponible.");

  let clientId: string;
  let sujet: string;
  if (input.reservationId) {
    const reservation = await db.reservation.findFirst({
      where: { id: input.reservationId, ...reservationAccess(viewer) },
      select: {
        reference: true,
        clientId: true,
        session: { select: { circuit: { select: { titre: true } } } },
        conversation: { select: { id: true } },
      },
    });
    if (!reservation) return failure("Réservation introuvable.");
    if (reservation.conversation) {
      return sendMessage(
        db,
        viewer,
        { conversationId: reservation.conversation.id, contenu: input.contenu },
        now,
      );
    }
    clientId = reservation.clientId;
    sujet = input.sujet ?? `${reservation.session.circuit.titre} · ${reservation.reference}`;
  } else {
    if (viewer.role !== "CLIENT") {
      return failure("Choisissez la réservation concernée pour écrire à un voyageur.");
    }
    clientId = viewer.id;
    sujet = input.sujet ?? "Question à l'agence";
  }

  try {
    return await db.$tenantTransaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          agenceId: input.agenceId,
          clientId,
          reservationId: input.reservationId,
          sujet,
          dernierMessageAt: now,
          createdAt: now,
        },
      });
      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          auteurId: viewer.id,
          contenu: input.contenu,
          createdAt: now,
        },
      });
      await markRead(tx, conversation.id, viewer.id, now);
      await publishMessage(tx, conversation.id, viewer.id, input.contenu);
      return success({ conversationId: conversation.id, messageId: message.id });
    });
  } catch (error: unknown) {
    // Deux premiers messages simultanés sur la même réservation : l'index unique tranche,
    // et le second message rejoint la conversation créée par le premier.
    if (
      input.reservationId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await db.conversation.findFirst({
        where: { reservationId: input.reservationId, ...conversationAccess(viewer) },
        select: { id: true },
      });
      if (existing) {
        return sendMessage(
          db,
          viewer,
          { conversationId: existing.id, contenu: input.contenu },
          now,
        );
      }
    }
    throw error;
  }
}

/** Interlocuteur affiché (photo, présence) ; jamais l'e-mail ni le téléphone. */
const PERSONNE = {
  select: {
    id: true,
    prenom: true,
    nom: true,
    photoUrl: true,
    derniereActiviteAt: true,
    presenceVisible: true,
  },
} as const;

const lastMessageSelect = {
  orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  take: 1,
  select: {
    contenu: true,
    createdAt: true,
    auteur: { select: { id: true, prenom: true, role: true } },
  },
} satisfies Prisma.Conversation$messagesArgs;

function conversationListSelect(viewerId: string) {
  return {
    id: true,
    sujet: true,
    type: true,
    dernierMessageAt: true,
    client: PERSONNE,
    destinataire: PERSONNE,
    reservation: {
      select: {
        id: true,
        reference: true,
        session: { select: { dateDebut: true, circuit: { select: { titre: true } } } },
      },
    },
    messages: lastMessageSelect,
    lectures: { where: { utilisateurId: viewerId }, select: { luJusqua: true } },
  } satisfies Prisma.ConversationSelect;
}

type ConversationListPayload = Prisma.ConversationGetPayload<{
  select: ReturnType<typeof conversationListSelect>;
}>;

export type ConversationSummary = Omit<ConversationListPayload, "messages" | "lectures"> & {
  dernierMessage: {
    contenu: string;
    createdAt: Date;
    auteurId: string;
    auteurPrenom: string;
    auteurRole: Role;
  } | null;
  nonLue: boolean;
};

function toSummary(viewer: Viewer, c: ConversationListPayload): ConversationSummary {
  const { messages, lectures, ...rest } = c;
  const last = messages[0];
  const dernierMessage = last
    ? {
        contenu: last.contenu,
        createdAt: last.createdAt,
        auteurId: last.auteur.id,
        auteurPrenom: last.auteur.prenom,
        auteurRole: last.auteur.role,
      }
    : null;
  return {
    ...rest,
    dernierMessage,
    nonLue: isUnreadIn(
      c.type,
      viewer,
      dernierMessage
        ? {
            createdAt: dernierMessage.createdAt,
            auteurId: dernierMessage.auteurId,
            auteurRole: dernierMessage.auteurRole,
          }
        : null,
      lectures[0]?.luJusqua ?? null,
    ),
  };
}

/** Conversations de l'utilisateur, la plus récemment active d'abord. */
export async function listConversations(
  db: TenantDb,
  viewer: Viewer,
  page: number,
): Promise<Paginated<ConversationSummary>> {
  const where = conversationAccess(viewer);
  const [items, total] = await Promise.all([
    db.conversation.findMany({
      where,
      select: conversationListSelect(viewer.id),
      orderBy: [{ dernierMessageAt: "desc" }, { id: "desc" }],
      ...pageArgs(page),
    }),
    db.conversation.count({ where }),
  ]);
  return {
    items: items.map((c) => toSummary(viewer, c)),
    total,
    page,
    pageCount: pageCount(total),
  };
}

/** Nombre de conversations non lues (pastille du menu « Messages »). */
export async function countUnreadConversations(db: TenantDb, viewer: Viewer): Promise<number> {
  const conversations = await db.conversation.findMany({
    where: conversationAccess(viewer),
    select: {
      type: true,
      messages: lastMessageSelect,
      lectures: { where: { utilisateurId: viewer.id }, select: { luJusqua: true } },
    },
  });
  return conversations.filter((c) => {
    const last = c.messages[0];
    return isUnreadIn(
      c.type,
      viewer,
      last
        ? { createdAt: last.createdAt, auteurId: last.auteur.id, auteurRole: last.auteur.role }
        : null,
      c.lectures[0]?.luJusqua ?? null,
    );
  }).length;
}

/** Nombre maximal de messages affichés dans un fil (les plus récents). */
export const THREAD_LIMIT = 200;

/** Fil d'une conversation accessible (null sinon : page 404). */
export async function getConversation(db: TenantDb, viewer: Viewer, id: string) {
  const conversation = await db.conversation.findFirst({
    where: { id, ...conversationAccess(viewer) },
    select: {
      id: true,
      sujet: true,
      type: true,
      createdAt: true,
      client: PERSONNE,
      destinataire: PERSONNE,
      reservation: {
        select: {
          id: true,
          reference: true,
          statut: true,
          session: {
            select: {
              id: true,
              dateDebut: true,
              dateFin: true,
              circuit: { select: { titre: true } },
              guide: { select: { prenom: true, nom: true } },
            },
          },
        },
      },
      lectures: {
        select: { luJusqua: true, utilisateurId: true, utilisateur: { select: { role: true } } },
      },
      messages: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: THREAD_LIMIT,
        select: {
          id: true,
          contenu: true,
          createdAt: true,
          auteur: { select: { id: true, prenom: true, nom: true, role: true, photoUrl: true } },
        },
      },
    },
  });
  if (!conversation) return null;
  const { lectures, ...rest } = conversation;
  const lus = lectures.map((l) => ({ luJusqua: l.luJusqua, role: l.utilisateur.role }));
  return {
    ...rest,
    // Accusé de lecture de chacun de MES messages (« distribué » ou « lu »), null sinon.
    messages: conversation.messages.reverse().map((m) => ({
      ...m,
      statut:
        conversation.type === "VOYAGEURS"
          ? privateDeliveryStatus(
              { createdAt: m.createdAt, auteurId: m.auteur.id },
              viewer.id,
              lectures,
            )
          : deliveryStatus({ createdAt: m.createdAt, auteurRole: m.auteur.role }, viewer.role, lus),
    })),
  };
}

export type ConversationThread = NonNullable<Awaited<ReturnType<typeof getConversation>>>;

/** Marque la conversation comme lue par l'utilisateur (à l'ouverture du fil). */
export async function markConversationRead(
  db: TenantDb,
  viewer: Viewer,
  conversationId: string,
  now: Date = new Date(),
): Promise<ServiceResult> {
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, ...conversationAccess(viewer) },
    select: { id: true, type: true },
  });
  if (!conversation) return failure("Conversation introuvable.");
  const prive = conversation.type === "VOYAGEURS";
  const previous = await db.lectureConversation.findUnique({
    where: {
      conversationId_utilisateurId: { conversationId: conversation.id, utilisateurId: viewer.id },
    },
    select: { luJusqua: true },
  });
  // Messages de l'autre côté lus pour la première fois : leurs auteurs voient « Lu ».
  const nouveaux = await db.message.count({
    where: {
      conversationId: conversation.id,
      createdAt: { gt: previous?.luJusqua ?? new Date(0), lte: now },
      // Entre voyageurs : les messages de l'autre ; sinon ceux de l'autre côté.
      ...(prive
        ? { auteurId: { not: viewer.id } }
        : { auteur: { role: { in: otherSideRoles(viewer.role) } } }),
    },
  });
  await markRead(db, conversation.id, viewer.id, now);
  if (nouveaux > 0) {
    const { membres } = await participants(db, conversation.id);
    const side = messagingSide(viewer.role);
    publish(
      membres
        .filter((m) => (prive ? m.id !== viewer.id : messagingSide(m.role) !== side))
        .map((m) => m.id),
      { type: "lecture", conversationId: conversation.id },
    );
  }
  return success(undefined);
}

/** Blocage entre deux voyageurs, dans un sens ou dans l'autre (étape 5c). */
export async function isBlockedBetween(db: TenantDb, a: string, b: string): Promise<boolean> {
  const n = await db.blocage.count({
    where: {
      OR: [
        { bloqueurId: a, bloqueId: b },
        { bloqueurId: b, bloqueId: a },
      ],
    },
  });
  return n > 0;
}

/**
 * Conversation privée entre deux voyageurs de la même agence (étape 5c). L'autre voyageur
 * doit être actif, accepter les messages des voyageurs, et aucun blocage ne doit exister. Une
 * conversation existante entre eux (dans un sens ou l'autre) est reprise.
 */
export async function startPrivateConversation(
  db: TenantDb,
  viewer: Viewer,
  input: { agenceId: string; destinataireId: string; contenu: string },
  now: Date = new Date(),
): Promise<ServiceResult<SentMessage>> {
  if (viewer.role !== "CLIENT") return failure("Réservé aux voyageurs.");
  if (input.destinataireId === viewer.id) return failure("Choisissez un autre voyageur.");
  const autre = await db.utilisateur.findFirst({
    where: { id: input.destinataireId, role: "CLIENT", actif: true },
    select: { messagesVoyageurs: true },
  });
  if (!autre) return failure("Voyageur introuvable.");
  if (await isBlockedBetween(db, viewer.id, input.destinataireId)) {
    return failure("Vous ne pouvez pas écrire à ce voyageur.");
  }
  const existante = await db.conversation.findFirst({
    where: {
      type: "VOYAGEURS",
      OR: [
        { clientId: viewer.id, destinataireId: input.destinataireId },
        { clientId: input.destinataireId, destinataireId: viewer.id },
      ],
    },
    select: { id: true },
  });
  if (existante) {
    return sendMessage(db, viewer, { conversationId: existante.id, contenu: input.contenu }, now);
  }
  if (!autre.messagesVoyageurs) return failure("Ce voyageur ne reçoit pas de messages.");
  return db.$tenantTransaction(async (tx) => {
    const conversation = await tx.conversation.create({
      data: {
        agenceId: input.agenceId,
        type: "VOYAGEURS",
        clientId: viewer.id,
        destinataireId: input.destinataireId,
        sujet: "Conversation entre voyageurs",
        dernierMessageAt: now,
        createdAt: now,
      },
    });
    const message = await tx.message.create({
      data: {
        conversationId: conversation.id,
        auteurId: viewer.id,
        contenu: input.contenu,
        createdAt: now,
      },
    });
    await markRead(tx, conversation.id, viewer.id, now);
    await publishMessage(tx, conversation.id, viewer.id, input.contenu);
    return success({ conversationId: conversation.id, messageId: message.id });
  });
}
