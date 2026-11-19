import { SIDE_LABELS, messagingSide } from "@/lib/messagerie";
import { type Presence, presenceOf } from "@/lib/presence";
import { itineraireIdFromLink, reservationIdFromLink } from "@/lib/push/expo";
import {
  type ConversationSummary,
  type ConversationThread,
  conversationAccess,
  countUnreadConversations,
  type Viewer,
} from "@/lib/services/messagerie";
import { nomPublic } from "@/lib/services/voyageurs";
import type { TenantDb } from "@/lib/tenant";

/**
 * Notifications et messagerie de l'application mobile (lot A4c). Lecture par les services du
 * site (client confiné, portée du voyageur) ; ici, seulement la mise en forme JSON.
 */

const NOTIFICATIONS_LIMIT = 30;

const notificationSelect = {
  id: true,
  titre: true,
  message: true,
  lienUrl: true,
  lue: true,
  createdAt: true,
} as const;

type NotificationRow = {
  id: string;
  titre: string;
  message: string;
  lienUrl: string | null;
  lue: boolean;
  createdAt: Date;
};

function toMobileNotification(n: NotificationRow) {
  return {
    id: n.id,
    titre: n.titre,
    message: n.message,
    lue: n.lue,
    at: n.createdAt.toISOString(),
    // Destination dans l'application (la réservation concernée), au lieu du lien du site.
    reservationId: reservationIdFromLink(n.lienUrl),
    itineraireId: itineraireIdFromLink(n.lienUrl),
  };
}

/** Dernières notifications du voyageur et nombre de non lues. */
export async function mobileNotifications(db: TenantDb, utilisateurId: string) {
  const [nonLues, items] = await Promise.all([
    db.notification.count({ where: { utilisateurId, lue: false } }),
    db.notification.findMany({
      where: { utilisateurId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: NOTIFICATIONS_LIMIT,
      select: notificationSelect,
    }),
  ]);
  return { nonLues, notifications: items.map(toMobileNotification) };
}

/**
 * Nouveautés depuis `depuis` (passage précédent de l'application, toutes les 20 secondes
 * environ) : notifications et messages reçus, plus les compteurs des pastilles. `serveur` est
 * l'heure du serveur, à renvoyer au passage suivant (l'horloge du téléphone peut différer).
 */
export async function mobileActivity(db: TenantDb, viewer: Viewer, depuis: Date | null, now: Date) {
  const [notifications, messages, nonLuesNotifications, nonLuesConversations] = await Promise.all([
    depuis
      ? db.notification.findMany({
          where: { utilisateurId: viewer.id, createdAt: { gt: depuis, lte: now } },
          orderBy: { createdAt: "asc" },
          take: 10,
          select: notificationSelect,
        })
      : [],
    depuis
      ? db.message.findMany({
          where: {
            createdAt: { gt: depuis, lte: now },
            auteurId: { not: viewer.id },
            conversation: conversationAccess(viewer),
          },
          orderBy: { createdAt: "asc" },
          take: 10,
          select: {
            id: true,
            conversationId: true,
            conversation: { select: { sujet: true } },
            auteur: { select: { prenom: true, nom: true } },
          },
        })
      : [],
    db.notification.count({ where: { utilisateurId: viewer.id, lue: false } }),
    countUnreadConversations(db, viewer),
  ]);
  return {
    serveur: now.toISOString(),
    nonLues: { notifications: nonLuesNotifications, conversations: nonLuesConversations },
    notifications: notifications.map(toMobileNotification),
    messages: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      sujet: m.conversation.sujet,
      auteur: `${m.auteur.prenom} ${m.auteur.nom.charAt(0)}.`,
    })),
  };
}

/** Conversation dans la liste « Messages ». */
export function toMobileConversation(
  c: ConversationSummary,
  viewerId: string,
  now: Date = new Date(),
) {
  const last = c.dernierMessage;
  // Conversation privée : l'autre voyageur (prénom, initiale, photo, présence).
  const prive = c.type === "VOYAGEURS";
  const autre = prive ? (c.client.id === viewerId ? c.destinataire : c.client) : null;
  return {
    id: c.id,
    sujet: prive && autre ? nomPublic(autre) : c.sujet,
    prive,
    interlocuteur: autre
      ? {
          id: autre.id,
          nom: nomPublic(autre),
          photo: autre.photoUrl,
          ...presenceOf(autre.derniereActiviteAt, autre.presenceVisible, now),
        }
      : null,
    nonLue: c.nonLue,
    at: c.dernierMessageAt.toISOString(),
    reservation: c.reservation
      ? { id: c.reservation.id, reference: c.reservation.reference }
      : null,
    dernierMessage: last
      ? {
          extrait: last.contenu.replace(/\s+/g, " ").slice(0, 140),
          deMoi: last.auteurId === viewerId,
          auteur: last.auteurId === viewerId ? "Vous" : last.auteurPrenom,
        }
      : null,
  };
}

/** Fil d'une conversation (messages du plus ancien au plus récent). */
export function toMobileThread(
  t: ConversationThread,
  viewerId: string,
  agenceLogo: string | null = null,
  extra: { presenceAgence?: Presence; bloque?: boolean; now?: Date } = {},
) {
  const now = extra.now ?? new Date();
  const prive = t.type === "VOYAGEURS";
  const autre = prive ? (t.client.id === viewerId ? t.destinataire : t.client) : null;
  return {
    id: t.id,
    sujet: prive && autre ? nomPublic(autre) : t.sujet,
    prive,
    /** Voyageur en face (conversation privée) : présence, et s'il y a un blocage entre vous. */
    interlocuteur: autre
      ? {
          id: autre.id,
          nom: nomPublic(autre),
          photo: autre.photoUrl,
          ...presenceOf(autre.derniereActiviteAt, autre.presenceVisible, now),
          bloque: extra.bloque ?? false,
        }
      : null,
    /** Présence de l'équipe de l'agence (conversation avec l'agence). */
    presenceAgence: prive ? null : (extra.presenceAgence ?? null),
    reservation: t.reservation
      ? {
          id: t.reservation.id,
          reference: t.reservation.reference,
          circuit: t.reservation.session.circuit.titre,
        }
      : null,
    messages: t.messages.map((m) => ({
      id: m.id,
      contenu: m.contenu,
      at: m.createdAt.toISOString(),
      deMoi: m.auteur.id === viewerId,
      auteur: `${m.auteur.prenom} ${m.auteur.nom.charAt(0)}.`,
      cote: SIDE_LABELS[messagingSide(m.auteur.role)],
      // Photo : logo de l'agence pour son équipe, sinon la photo de l'auteur (ou null).
      photo:
        messagingSide(m.auteur.role) === "AGENCE"
          ? (agenceLogo ?? m.auteur.photoUrl ?? null)
          : (m.auteur.photoUrl ?? null),
      // Accusé de lecture de mes messages : « DISTRIBUE » ou « LU », null pour les autres.
      statut: m.statut,
    })),
  };
}
