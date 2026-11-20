"use client";

import Link from "next/link";
import { useState } from "react";

import { PostMenu } from "@/components/communaute/content-actions";
import { LikeButton } from "@/components/communaute/like-button";
import { PhotoGrid } from "@/components/communaute/photo-grid";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { formatDateTime } from "@/lib/format";
import type { PublicationCard as Card } from "@/lib/services/communaute";

const EXTRAIT = 220;

/** Une publication : auteur, séjour, photos en mosaïque, légende, réactions, menu « … ». */
export function PublicationCard({
  p,
  basePath,
  detail = false,
  onDeleted,
}: {
  p: Card;
  /** `/a/<slug>/mon-compte/communaute`. */
  basePath: string;
  detail?: boolean;
  onDeleted?: () => void;
}) {
  const [ouvert, setOuvert] = useState(detail);
  const alt = `Séjour « ${p.circuit.titre} » partagé par ${p.auteur.nom}`;
  const longue = (p.legende?.length ?? 0) > EXTRAIT;
  const href = `${basePath}/${p.id}`;

  return (
    <article className="space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gt-mist/60 sm:p-5">
      <header className="flex items-start gap-3">
        <Avatar name={p.auteur.nom} src={p.auteur.photo} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gt-teal-900">{p.auteur.nom}</p>
          <p className="text-xs text-gt-teal-900/75">
            {p.circuit.slug ? (
              <Link
                href={`/a/${p.agence.slug}/circuits/${p.circuit.slug}`}
                className="font-medium text-gt-teal-700 hover:underline"
              >
                {p.circuit.titre}
              </Link>
            ) : (
              p.circuit.titre
            )}{" "}
            · avec {p.agence.nom}
          </p>
          <p className="text-[11px] text-gt-teal-900/60">{formatDateTime(p.createdAt)}</p>
        </div>
        <PostMenu
          cible="PUBLICATION"
          id={p.id}
          deMoi={p.deMoi}
          afterDelete={detail ? basePath : undefined}
          onDeleted={onDeleted}
        />
      </header>

      <PhotoGrid photos={p.photos} alt={alt} entieres={detail} href={detail ? undefined : href} />

      {p.legende ? (
        <p className="text-sm leading-relaxed whitespace-pre-line text-gt-teal-900">
          {longue && !ouvert ? `${p.legende.slice(0, EXTRAIT).trimEnd()}… ` : p.legende}
          {longue && !ouvert ? (
            <button
              type="button"
              onClick={() => setOuvert(true)}
              className="font-semibold text-gt-teal-700 hover:underline"
            >
              lire la suite
            </button>
          ) : null}
        </p>
      ) : null}

      <footer className="flex items-center gap-1 border-t border-gt-mist/60 pt-2">
        <LikeButton publicationId={p.id} jAime={p.jAime} jaimes={p.jaimes} />
        <Link
          href={detail ? "#commentaires" : `${href}#commentaires`}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-gt-teal-900 hover:bg-gt-teal-50"
        >
          <Icon name="message" className="size-5" />
          {p.commentaires}
          <span className="sr-only"> commentaire{p.commentaires > 1 ? "s" : ""}</span>
        </Link>
        {!detail ? (
          <Link
            href={`${basePath}?circuit=${p.circuit.id}`}
            className="ml-auto inline-flex max-w-[45%] items-center gap-1 truncate rounded-full bg-gt-teal-50 px-3 py-1 text-xs font-medium text-gt-teal-800 hover:bg-gt-teal-100"
          >
            <Icon name="pin" className="size-3.5" />
            <span className="truncate">{p.circuit.titre}</span>
          </Link>
        ) : null}
      </footer>
    </article>
  );
}
