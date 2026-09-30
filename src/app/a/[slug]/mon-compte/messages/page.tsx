import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { MessagingPanel, NoConversation } from "@/components/messagerie/messaging-panel";
import { StartConversationForm } from "@/components/messagerie/start-conversation-form";
import { FormModal } from "@/components/ui/form-modal";
import { requireClient } from "@/lib/auth/session";
import { parsePage } from "@/lib/pagination";
import { listConversations } from "@/lib/services/messagerie";

export const metadata: Metadata = { title: "Messages" };

/** Messagerie du voyageur (après E12) : ses conversations avec l'agence et son guide. */
export default async function ClientMessagesPage({
  params,
  searchParams,
}: PageProps<"/a/[slug]/mon-compte/messages">) {
  const { slug } = await params;
  const { user, db } = await requireClient(slug, `/a/${slug}/mon-compte/messages`);
  const list = await listConversations(
    db,
    { id: user.id, role: user.role },
    parsePage((await searchParams).page),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Messages"
        description="Écrivez à l'agence : l'équipe (et votre guide, pour une réservation) vous répond ici."
        actions={
          <FormModal
            triggerLabel="Nouvelle question"
            triggerIcon="message"
            title="Écrire à l'agence"
            description="Pour une réservation, écrivez plutôt depuis sa fiche : votre guide verra aussi le message."
          >
            <StartConversationForm placeholder="Votre question…" />
          </FormModal>
        }
      />
      <MessagingPanel
        list={list}
        basePath={`/a/${slug}/mon-compte/messages`}
        viewerId={user.id}
        viewerRole={user.role}
        emptyList="Aucune conversation. Posez une question à l'agence, ou écrivez depuis la fiche d'une réservation."
      >
        <NoConversation text="Choisissez une conversation, ou posez une nouvelle question." />
      </MessagingPanel>
    </div>
  );
}
