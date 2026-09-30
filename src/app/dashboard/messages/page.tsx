import type { Metadata } from "next";

import { MessagingPanel, NoConversation } from "@/components/messagerie/messaging-panel";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireAgencyUser } from "@/lib/auth/session";
import { parsePage } from "@/lib/pagination";
import { listConversations } from "@/lib/services/messagerie";

export const metadata: Metadata = { title: "Messages — Green Trek" };

/**
 * Messagerie du back-office (après E12) : boîte partagée de l'agence (administrateur et
 * personnel), ou conversations des départs du guide connecté.
 */
export default async function MessagesPage({ searchParams }: PageProps<"/dashboard/messages">) {
  const { user, db } = await requireAgencyUser();
  const viewer = { id: user.id, role: user.role };
  const list = await listConversations(db, viewer, parsePage((await searchParams).page));
  const guide = user.role === "GUIDE";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Messages"
        description={
          guide
            ? "Les échanges avec les voyageurs de vos départs, et avec l'agence à leur sujet."
            : "Les échanges avec vos voyageurs, partagés par toute l'équipe : chacun peut répondre au nom de l'agence."
        }
      />
      <MessagingPanel
        list={list}
        basePath="/dashboard/messages"
        viewerId={user.id}
        viewerRole={user.role}
        emptyList={
          guide
            ? "Aucune conversation sur vos départs pour l'instant."
            : "Aucune conversation pour l'instant. Les voyageurs vous écrivent depuis leur espace ; vous pouvez aussi écrire à un voyageur depuis la fiche de sa réservation."
        }
      >
        <NoConversation text="Choisissez une conversation pour afficher les messages." />
      </MessagingPanel>
    </div>
  );
}
