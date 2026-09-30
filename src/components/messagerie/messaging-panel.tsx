import Link from "next/link";
import type { ReactNode } from "react";

import { Pagination } from "@/components/dashboard/pagination";
import { Icon } from "@/components/ui/icon";
import type { Role } from "@/generated/prisma/client";
import type { Paginated } from "@/lib/pagination";
import type { ConversationSummary } from "@/lib/services/messagerie";

import { ConversationList } from "./conversation-list";

/**
 * Messagerie en deux volets (après E12) : conversations à gauche, fil à droite. Sur mobile,
 * un seul volet à la fois : la liste, ou le fil ouvert (avec un lien de retour).
 */
export function MessagingPanel({
  list,
  basePath,
  viewerId,
  viewerRole,
  activeId,
  emptyList,
  children,
}: {
  list: Paginated<ConversationSummary>;
  basePath: string;
  viewerId: string;
  viewerRole: Role;
  activeId?: string;
  emptyList: ReactNode;
  /** Volet droit : fil ouvert, ou invitation à choisir une conversation. */
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gt-mist/60 lg:grid lg:h-[calc(100dvh-13rem)] lg:min-h-[480px] lg:grid-cols-[340px_minmax(0,1fr)]">
      <section
        aria-label="Conversations"
        className={`min-h-0 flex-col border-gt-mist/70 lg:flex lg:border-r ${activeId ? "hidden" : "flex"}`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.total === 0 ? (
            <div className="p-6 text-sm text-gt-teal-900/75">{emptyList}</div>
          ) : (
            <ConversationList
              items={list.items}
              basePath={basePath}
              viewerId={viewerId}
              viewerRole={viewerRole}
              activeId={activeId}
            />
          )}
        </div>
        {list.pageCount > 1 ? (
          <div className="border-t border-gt-mist/70 px-2 py-2">
            <Pagination basePath={basePath} page={list.page} pageCount={list.pageCount} />
          </div>
        ) : null}
      </section>
      <section
        aria-label="Conversation"
        className={`min-h-0 flex-col bg-gt-canvas/60 lg:flex ${activeId ? "flex min-h-[70dvh]" : "hidden"}`}
      >
        {activeId ? (
          <Link
            href={basePath}
            className="flex items-center gap-1 border-b border-gt-mist/70 bg-white px-4 py-2 text-sm font-medium text-gt-teal-700 lg:hidden"
          >
            ← Conversations
          </Link>
        ) : null}
        {children}
      </section>
    </div>
  );
}

/** Volet droit sans conversation ouverte. */
export function NoConversation({ text }: { text: string }) {
  return (
    <div className="grid flex-1 place-items-center p-8 text-center">
      <div>
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-gt-teal-100 text-gt-teal-700">
          <Icon name="message" className="size-6" />
        </span>
        <p className="mt-3 text-sm text-gt-teal-900/75">{text}</p>
      </div>
    </div>
  );
}

/** En-tête du fil : sujet et informations utiles (réservation, départ, guide). */
export function ThreadHeader({
  titre,
  details,
  action,
}: {
  titre: string;
  details: readonly ReactNode[];
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gt-mist/70 bg-white px-4 py-3 sm:px-6">
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-gt-teal-900">{titre}</h2>
        <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gt-teal-900/75">
          {details.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </p>
      </div>
      {action}
    </header>
  );
}
