import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MessagingPanel, ThreadHeader } from "@/components/messagerie/messaging-panel";
import { Thread } from "@/components/messagerie/thread";
import { getVitrineAgency } from "@/lib/public-agency";
import { requireClient } from "@/lib/auth/session";
import { formatDateRange } from "@/lib/format";
import { presenceOf, presenceOfGroup } from "@/lib/presence";
import { getConversation, listConversations } from "@/lib/services/messagerie";
import { nomPublic } from "@/lib/services/voyageurs";

import { presenceText } from "@/components/ui/presence-avatar";
import { BlockButton } from "@/components/voyageurs/block-button";

export const metadata: Metadata = { title: "Conversation" };

/** Fil d'une conversation du voyageur (404 pour la conversation d'un autre client). */
export default async function ClientConversationPage({
  params,
}: PageProps<"/a/[slug]/mon-compte/messages/[id]">) {
  const { slug, id } = await params;
  const { user, db } = await requireClient(slug, `/a/${slug}/mon-compte/messages/${id}`);
  const viewer = { id: user.id, role: user.role };
  const [thread, list, agence, equipe] = await Promise.all([
    getConversation(db, viewer, id),
    listConversations(db, viewer, 1),
    getVitrineAgency(slug),
    db.utilisateur.findMany({
      where: { actif: true, role: { in: ["ADMIN_AGENCE", "STAFF"] } },
      select: { derniereActiviteAt: true, presenceVisible: true },
    }),
  ]);
  if (!thread) notFound();
  const now = new Date();
  const prive = thread.type === "VOYAGEURS";
  const autre = prive ? (thread.client.id === user.id ? thread.destinataire : thread.client) : null;

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
  // Présence : l'autre voyageur, ou l'équipe de l'agence (au moins un membre en ligne).
  const presence = autre
    ? presenceOf(autre.derniereActiviteAt, autre.presenceVisible, now)
    : presenceOfGroup(equipe, now);
  const etat = presenceText(presence);

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
        agenceLogo={agence?.logoUrl ?? null}
      >
        {autre ? (
          <ThreadHeader
            titre={nomPublic(autre)}
            details={["Conversation entre voyageurs", ...(etat ? [etat] : [])]}
            action={<BlockButton id={autre.id} nom={nomPublic(autre)} />}
          />
        ) : (
          <ThreadHeader
            titre={thread.sujet}
            details={[...details, ...(etat ? [`Agence : ${etat.toLowerCase()}`] : [])]}
          />
        )}
        <Thread
          conversationId={thread.id}
          messages={thread.messages}
          viewerId={user.id}
          viewerRole={user.role}
          agenceLogo={agence?.logoUrl ?? null}
          prive={prive}
        />
      </MessagingPanel>
    </div>
  );
}
