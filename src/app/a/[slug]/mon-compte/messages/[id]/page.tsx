import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MessagingPanel, ThreadHeader } from "@/components/messagerie/messaging-panel";
import { Thread } from "@/components/messagerie/thread";
import { requireClient } from "@/lib/auth/session";
import { formatDateRange } from "@/lib/format";
import { getConversation, listConversations } from "@/lib/services/messagerie";

export const metadata: Metadata = { title: "Conversation" };

/** Fil d'une conversation du voyageur (404 pour la conversation d'un autre client). */
export default async function ClientConversationPage({
  params,
}: PageProps<"/a/[slug]/mon-compte/messages/[id]">) {
  const { slug, id } = await params;
  const { user, db } = await requireClient(slug, `/a/${slug}/mon-compte/messages/${id}`);
  const viewer = { id: user.id, role: user.role };
  const [thread, list] = await Promise.all([
    getConversation(db, viewer, id),
    listConversations(db, viewer, 1),
  ]);
  if (!thread) notFound();

  const r = thread.reservation;
  const details = r
    ? [
        <Link
          key="resa"
          href={`/a/${slug}/mon-compte/reservations/${r.id}`}
          className="font-medium text-gt-teal-700 underline"
        >
          Réservation {r.reference}
        </Link>,
        formatDateRange(r.session.dateDebut, r.session.dateFin),
        r.session.guide
          ? `Votre guide : ${r.session.guide.prenom} ${r.session.guide.nom.charAt(0)}.`
          : "Guide bientôt affecté",
      ]
    : ["Question à l'agence"];

  return (
    <div className="space-y-5">
      <h2 className="sr-only">Messages</h2>
      <MessagingPanel
        list={list}
        basePath={`/a/${slug}/mon-compte/messages`}
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
