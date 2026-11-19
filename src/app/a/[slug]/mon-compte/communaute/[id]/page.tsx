import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CommentForm } from "@/components/communaute/comment-form";
import { ContentActions } from "@/components/communaute/content-actions";
import { PublicationCard } from "@/components/communaute/publication-card";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { requireClient } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { getPublication } from "@/lib/services/communaute";

export const metadata: Metadata = { title: "Publication" };

/** Une publication : photos en entier, sans recadrage, et ses commentaires. */
export default async function PublicationPage({
  params,
}: PageProps<"/a/[slug]/mon-compte/communaute/[id]">) {
  const { slug, id } = await params;
  const { user } = await requireClient(slug, `/a/${slug}/mon-compte/communaute/${id}`);
  const p = await getPublication(user.id, id);
  if (!p) notFound();
  const basePath = `/a/${slug}/mon-compte/communaute`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={basePath}
        className="inline-flex items-center gap-1 text-sm font-medium text-gt-teal-700 underline"
      >
        <Icon name="arrowLeft" className="size-4" />
        Communauté
      </Link>
      <PublicationCard p={p} basePath={basePath} detail />
      <section id="commentaires" aria-labelledby="titre-commentaires" className="space-y-4">
        <h2 id="titre-commentaires" className="text-lg font-semibold text-gt-teal-900">
          Commentaires
        </h2>
        {p.listeCommentaires.length === 0 ? (
          <p className="text-sm text-gt-teal-900/75">Soyez le premier à commenter.</p>
        ) : (
          <ul className="space-y-3">
            {p.listeCommentaires.map((c) => (
              <li key={c.id} className="flex gap-3">
                <Avatar name={c.auteur.nom} src={c.auteur.photo} size={32} />
                <div className="min-w-0 flex-1 rounded-2xl bg-white px-4 py-2 ring-1 ring-gt-mist/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-gt-teal-900/75">
                      <span className="font-semibold text-gt-teal-900">{c.auteur.nom}</span> ·{" "}
                      {formatDateTime(c.createdAt)}
                    </p>
                    <ContentActions cible="COMMENTAIRE" id={c.id} deMoi={c.deMoi} />
                  </div>
                  <p className="text-sm whitespace-pre-line text-gt-teal-900">{c.contenu}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <CommentForm publicationId={p.id} />
      </section>
    </div>
  );
}
