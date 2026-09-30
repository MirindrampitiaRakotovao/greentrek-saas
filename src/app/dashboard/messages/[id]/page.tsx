import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MessagingPanel, ThreadHeader } from "@/components/messagerie/messaging-panel";
import { Thread } from "@/components/messagerie/thread";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatDateRange } from "@/lib/format";
import { getConversation, listConversations } from "@/lib/services/messagerie";

export const metadata: Metadata = { title: "Conversation — Green Trek" };

/** Fil d'une conversation dans le back-office (404 si hors de la portée de l'utilisateur). */
export default async function ConversationPage({ params }: PageProps<"/dashboard/messages/[id]">) {
  const { id } = await params;
  const { user, db } = await requireAgencyUser();
  const viewer = { id: user.id, role: user.role };
  const [thread, list] = await Promise.all([
    getConversation(db, viewer, id),
    listConversations(db, viewer, 1),
  ]);
  if (!thread) notFound();

  const r = thread.reservation;
  const details = [
    `${thread.client.prenom} ${thread.client.nom}`,
    ...(r
      ? [
          user.role === "GUIDE" ? (
            <Link
              key="depart"
              href={`/dashboard/departs/${r.session.id}`}
              className="font-medium text-gt-teal-700 underline"
            >
              Départ du {formatDateRange(r.session.dateDebut, r.session.dateFin)}
            </Link>
          ) : (
            <Link
              key="resa"
              href={`/dashboard/reservations/${r.id}`}
              className="font-medium text-gt-teal-700 underline"
            >
              Réservation {r.reference}
            </Link>
          ),
          r.session.guide
            ? `Guide : ${r.session.guide.prenom} ${r.session.guide.nom}`
            : "Pas de guide affecté",
        ]
      : ["Question générale"]),
  ];

  return (
    <div className="space-y-5">
      <h2 className="sr-only">Messages</h2>
      <MessagingPanel
        list={list}
        basePath="/dashboard/messages"
        viewerId={user.id}
        viewerRole={user.role}
        activeId={thread.id}
        emptyList="Aucune conversation."
      >
        <ThreadHeader titre={thread.sujet} details={details} />
        <Thread
          conversationId={thread.id}
          messages={thread.messages}
          viewerId={user.id}
          viewerRole={user.role}
        />
      </MessagingPanel>
    </div>
  );
}
