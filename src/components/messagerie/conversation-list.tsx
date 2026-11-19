import Link from "next/link";

import type { Role } from "@/generated/prisma/client";
import { formatMessageDate } from "@/lib/format";
import { messagingSide, SIDE_LABELS } from "@/lib/messagerie";
import { presenceOf } from "@/lib/presence";
import type { ConversationSummary } from "@/lib/services/messagerie";
import { nomPublic } from "@/lib/services/voyageurs";

import { PresenceAvatar } from "@/components/ui/presence-avatar";

/**
 * Liste des conversations (messagerie, après E12) : interlocuteur, sujet, dernier message et
 * pastille « non lu ». Pour le client, l'interlocuteur est l'agence : on affiche le sujet.
 */
export function ConversationList({
  items,
  basePath,
  viewerId,
  viewerRole,
  activeId,
  agenceLogo = null,
}: {
  items: readonly ConversationSummary[];
  basePath: string;
  viewerId: string;
  viewerRole: Role;
  activeId?: string;
  agenceLogo?: string | null;
}) {
  const client = viewerRole === "CLIENT";
  const now = new Date();
  return (
    <ul className="divide-y divide-gt-mist/60">
      {items.map((c) => {
        const active = c.id === activeId;
        // Interlocuteur : l'autre voyageur (conversation privée), l'agence (pour le voyageur) ou
        // le voyageur (pour l'équipe).
        const prive = c.type === "VOYAGEURS";
        const autre = prive ? (c.client.id === viewerId ? c.destinataire : c.client) : c.client;
        const titre = prive
          ? autre
            ? nomPublic(autre)
            : "Voyageur"
          : client
            ? c.sujet
            : `${c.client.prenom} ${c.client.nom}`;
        const last = c.dernierMessage;
        // « Vous » pour ses propres messages ; sinon le prénom (et, pour le voyageur, le rôle).
        const auteur = last
          ? last.auteurId === viewerId
            ? "Vous"
            : `${last.auteurPrenom}${client ? ` (${SIDE_LABELS[messagingSide(last.auteurRole)]})` : ""}`
          : null;
        return (
          <li key={c.id}>
            <Link
              href={`${basePath}/${c.id}`}
              aria-current={active ? "page" : undefined}
              className={`flex gap-3 px-4 py-3 transition-colors ${
                active ? "bg-gt-teal-100" : "hover:bg-gt-teal-50"
              }`}
            >
              {client && !prive ? (
                <PresenceAvatar name="Agence" src={agenceLogo} size={40} />
              ) : (
                <PresenceAvatar
                  name={titre}
                  src={autre?.photoUrl}
                  presence={
                    autre ? presenceOf(autre.derniereActiviteAt, autre.presenceVisible, now) : null
                  }
                  size={40}
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={`truncate text-sm text-gt-teal-900 ${c.nonLue ? "font-bold" : "font-medium"}`}
                  >
                    {titre}
                  </span>
                  <span className="shrink-0 text-xs text-gt-teal-900/75">
                    {formatMessageDate(c.dernierMessageAt)}
                  </span>
                </span>
                {!client || prive ? (
                  <span className="block truncate text-xs text-gt-teal-900/75">
                    {prive ? "Conversation entre voyageurs" : c.sujet}
                  </span>
                ) : null}
                {last ? (
                  <span
                    className={`mt-0.5 flex items-center gap-2 text-sm ${c.nonLue ? "font-semibold text-gt-teal-900" : "text-gt-teal-900/75"}`}
                  >
                    <span className="truncate">
                      {auteur} : {last.contenu}
                    </span>
                    {c.nonLue ? (
                      <span className="size-2.5 shrink-0 rounded-full bg-gt-chart-1">
                        <span className="sr-only">(non lu)</span>
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
