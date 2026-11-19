import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/dashboard/widgets";
import { AnswerItineraire } from "@/components/itineraires-perso/answer-itineraire";
import { ItineraireMap } from "@/components/itineraires-perso/itineraire-map";
import { Badge } from "@/components/ui/badge";
import { requireClient } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { getItineraireClient } from "@/lib/services/itineraires-perso";

export const metadata: Metadata = { title: "Itinéraire" };

/** Fiche d'un itinéraire sur mesure du voyageur : carte, chiffres, étapes, réponse. */
export default async function ItinerairePage({
  params,
}: PageProps<"/a/[slug]/mon-compte/itineraires/[id]">) {
  const { slug, id } = await params;
  const { user, db } = await requireClient(slug, `/a/${slug}/mon-compte/itineraires/${id}`);
  const it = await getItineraireClient(db, id, user.id);
  if (!it) notFound();
  const peutRepondre = it.origine === "AGENCE" && it.statut === "EN_ATTENTE";

  return (
    <div className="space-y-5">
      <Link
        href={`/a/${slug}/mon-compte/itineraires`}
        className="text-sm font-medium text-gt-teal-700 underline"
      >
        ← Mes itinéraires
      </Link>
      <PageHeader
        title={it.titre}
        description={`${it.origine === "AGENCE" ? `Proposé par ${it.auteur}` : "Votre demande"} le ${formatDateTime(it.createdAt)}`}
        actions={
          <Badge
            tone={it.statut === "ACCEPTE" ? "success" : it.statut === "DECLINE" ? "danger" : "sand"}
          >
            {it.statutLabel}
          </Badge>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="h-[420px] overflow-hidden rounded-3xl border border-gt-mist/70 lg:h-[560px]">
          <ItineraireMap etapes={it.etapes} />
        </div>
        <div className="space-y-5">
          <Card title="En bref">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-gt-teal-50 p-3">
                <dt className="text-xs text-gt-teal-900/75">Distance</dt>
                <dd className="text-lg font-semibold text-gt-teal-900">
                  {it.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km
                </dd>
              </div>
              <div className="rounded-xl bg-gt-teal-50 p-3">
                <dt className="text-xs text-gt-teal-900/75">Marche</dt>
                <dd className="text-lg font-semibold text-gt-teal-900">
                  {Math.floor(it.dureeMinutes / 60)} h{" "}
                  {String(it.dureeMinutes % 60).padStart(2, "0")}
                </dd>
              </div>
              <div className="rounded-xl bg-gt-teal-50 p-3">
                <dt className="text-xs text-gt-teal-900/75">Critère</dt>
                <dd className="font-semibold text-gt-teal-900">{it.critere}</dd>
              </div>
              <div className="rounded-xl bg-gt-teal-50 p-3">
                <dt className="text-xs text-gt-teal-900/75">Difficulté moyenne</dt>
                <dd className="font-semibold text-gt-teal-900">
                  {it.difficulteMoyenne === null
                    ? "—"
                    : `${it.difficulteMoyenne.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} / 5`}
                </dd>
              </div>
            </dl>
            {it.message ? (
              <p className="mt-4 rounded-xl border border-gt-mist/70 p-3 text-sm text-gt-teal-900">
                « {it.message} »
              </p>
            ) : null}
          </Card>
          <Card title="Étapes">
            <ol className="space-y-2 text-sm text-gt-teal-900">
              {it.etapes.map((e, i) => (
                <li key={`${e.id}-${i}`} className="flex items-center gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gt-teal-700 text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  {e.nom}
                </li>
              ))}
            </ol>
          </Card>
          <Card title="Votre réponse">
            {peutRepondre ? (
              <AnswerItineraire id={it.id} />
            ) : it.reponduAt ? (
              <p className="text-sm text-gt-teal-900">
                {it.statutLabel} le {formatDateTime(it.reponduAt)}
                {it.reponse ? ` : « ${it.reponse} »` : "."}
              </p>
            ) : (
              <p className="text-sm text-gt-teal-900/75">
                En attente de la réponse de l&apos;agence.
              </p>
            )}
            <Link
              href={`/a/${slug}/mon-compte/messages`}
              className="mt-3 inline-block text-sm font-medium text-gt-teal-700 underline"
            >
              Écrire à l&apos;agence
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
