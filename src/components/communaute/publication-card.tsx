import Link from "next/link";

import { ContentActions } from "@/components/communaute/content-actions";
import { LikeButton } from "@/components/communaute/like-button";
import { PhotoGrid } from "@/components/communaute/photo-grid";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { formatDateTime } from "@/lib/format";
import type { PublicationCard as Card } from "@/lib/services/communaute";

/** Une publication du fil : auteur, séjour (agence et circuit), photos, légende, réactions. */
export function PublicationCard({
  p,
  basePath,
  detail = false,
}: {
  p: Card;
  /** `/a/<slug>/mon-compte/communaute`. */
  basePath: string;
  detail?: boolean;
}) {
  const alt = `Séjour « ${p.circuit.titre} » partagé par ${p.auteur.nom}`;
  return (
    <article className="space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gt-mist/60 sm:p-5">
      <header className="flex items-center gap-3">
        <Avatar name={p.auteur.nom} src={p.auteur.photo} size={40} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gt-teal-900">{p.auteur.nom}</p>
          <p className="truncate text-xs text-gt-teal-900/75">
            {p.circuit.slug ? (
              <Link
                href={`/a/${p.agence.slug}/circuits/${p.circuit.slug}`}
                className="font-medium underline"
              >
                {p.circuit.titre}
              </Link>
            ) : (
              p.circuit.titre
            )}{" "}
            · avec {p.agence.nom} · {formatDateTime(p.createdAt)}
          </p>
        </div>
        <ContentActions
          cible="PUBLICATION"
          id={p.id}
          deMoi={p.deMoi}
          afterDelete={detail ? basePath : undefined}
        />
      </header>
      {detail ? (
        <PhotoGrid photos={p.photos} alt={alt} entieres />
      ) : (
        <Link href={`${basePath}/${p.id}`} aria-label={`Voir la publication de ${p.auteur.nom}`}>
          <PhotoGrid photos={p.photos} alt={alt} />
        </Link>
      )}
      {p.legende ? (
        <p className="text-sm whitespace-pre-line text-gt-teal-900">{p.legende}</p>
      ) : null}
      <footer className="flex items-center gap-2 border-t border-gt-mist/60 pt-2">
        <LikeButton publicationId={p.id} jAime={p.jAime} jaimes={p.jaimes} />
        {detail ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gt-teal-900">
            <Icon name="message" className="size-5" />
            {p.commentaires} commentaire{p.commentaires > 1 ? "s" : ""}
          </span>
        ) : (
          <Link
            href={`${basePath}/${p.id}#commentaires`}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-gt-teal-900 hover:bg-gt-teal-50"
          >
            <Icon name="message" className="size-5" />
            {p.commentaires} commentaire{p.commentaires > 1 ? "s" : ""}
          </Link>
        )}
      </footer>
    </article>
  );
}
