import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { MessagingPanel, NoConversation } from "@/components/messagerie/messaging-panel";
import { StartConversationForm } from "@/components/messagerie/start-conversation-form";
import { FormModal } from "@/components/ui/form-modal";
import { requireClient } from "@/lib/auth/session";
import { getVitrineAgency } from "@/lib/public-agency";
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
  const [list, agence] = await Promise.all([
    listConversations(db, { id: user.id, role: user.role }, parsePage((await searchParams).page)),
    getVitrineAgency(slug),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Messages"
        description="Écrivez à l'agence (l'équipe, et votre guide pour une réservation) ou à d'autres voyageurs."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/a/${slug}/mon-compte/voyageurs`}
              className="rounded-full border border-gt-teal-700 px-4 py-2 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50"
            >
              Écrire à un voyageur
            </Link>
            <FormModal
              triggerLabel="Nouvelle question"
              triggerIcon="message"
              title="Écrire à l'agence"
              description="Pour une réservation, écrivez plutôt depuis sa fiche : votre guide verra aussi le message."
            >
              <StartConversationForm placeholder="Votre question…" />
            </FormModal>
          </div>
        }
      />
      <MessagingPanel
        list={list}
        basePath={`/a/${slug}/mon-compte/messages`}
        viewerId={user.id}
        viewerRole={user.role}
        agenceLogo={agence?.logoUrl ?? null}
        emptyList="Aucune conversation. Posez une question à l'agence, ou écrivez depuis la fiche d'une réservation."
      >
        <NoConversation text="Choisissez une conversation, ou posez une nouvelle question." />
      </MessagingPanel>
    </div>
  );
}
