import Link from "next/link";

import { Stars } from "@/components/ui/stars";
import type { PublicAvis } from "@/lib/services/avis";

const monthYear = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "Indian/Antananarivo",
});

/**
 * Avis publiés des voyageurs (site vitrine, étape E12) : note, commentaire, prénom et
 * initiale du nom, mois du dépôt. Lien vers le circuit quand la liste mélange les circuits.
 */
export function ReviewList({
  avis,
  agenceSlug,
  showCircuit = false,
  columns = 3,
}: {
  avis: readonly PublicAvis[];
  agenceSlug: string;
  showCircuit?: boolean;
  columns?: 2 | 3;
}) {
  return (
    <ul className={`grid gap-4 md:grid-cols-2 ${columns === 3 ? "lg:grid-cols-3" : ""}`}>
      {avis.map((a) => (
        <li key={a.id}>
          <figure className="flex h-full flex-col rounded-3xl bg-white p-6 shadow-md ring-1 shadow-gt-teal-900/5 ring-gt-mist/60">
            <Stars note={a.note} />
            <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-gt-teal-900/85">
              <p>« {a.commentaire} »</p>
            </blockquote>
            <figcaption className="mt-4 text-sm">
              <span className="font-semibold text-gt-teal-900">{a.auteur}</span>
              <span className="text-gt-teal-900/75"> · {monthYear.format(a.createdAt)}</span>
              {showCircuit ? (
                <Link
                  href={`/a/${agenceSlug}/circuits/${a.circuit.slug}`}
                  className="mt-1 block text-xs font-medium text-gt-teal-700 underline"
                >
                  {a.circuit.titre}
                </Link>
              ) : null}
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
