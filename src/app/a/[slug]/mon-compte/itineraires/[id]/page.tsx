import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/dashboard/widgets";
import { AnswerItineraire } from "@/components/itineraires-perso/answer-itineraire";
import { DepartActions, ProgramDepartForm } from "@/components/itineraires-perso/depart-sur-mesure";
import { ItineraireMap } from "@/components/itineraires-perso/itineraire-map";
import { Badge } from "@/components/ui/badge";
import { requireClient } from "@/lib/auth/session";
import { calendarDate } from "@/lib/dates";
import { firstBookableDate, toIsoDate } from "@/lib/departs";
import { formatDateRange, formatDateTime, formatMoney } from "@/lib/format";
import { getVitrineAgency } from "@/lib/public-agency";
import { listDepartsOfItineraire } from "@/lib/services/departs-sur-mesure";
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
  // Étape 9 : départ programmé (le courant est le plus récent encore actif).
  const [departs, agence] = await Promise.all([
    listDepartsOfItineraire(db, it.id),
    getVitrineAgency(slug),
  ]);
  const courant = departs.find((d) => d.statut === "DEMANDE" || d.statut === "CONFIRME");
  const anciens = departs.filter((d) => d !== courant);
  const today = calendarDate(new Date());
  const minDate = toIsoDate(firstBookableDate(today));
  const devise = agence?.devise ?? "MGA";

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
          {it.statut === "ACCEPTE" ? (
            <Card title="Départ">
              {courant ? (
                <div className="space-y-3 text-sm text-gt-teal-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">
                      {formatDateRange(courant.dateDebut, courant.dateFin)} ·{" "}
                      {courant.nombrePersonnes} pers.
                    </p>
                    <Badge tone={courant.statut === "CONFIRME" ? "success" : "sand"}>
                      {courant.statutLabel}
                    </Badge>
                  </div>
                  {courant.statut === "CONFIRME" ? (
                    <dl className="space-y-1">
                      {courant.tarif !== null ? (
                        <div>
                          <dt className="inline text-gt-teal-900/75">Tarif : </dt>
                          <dd className="inline font-medium">
                            {formatMoney(courant.tarif, devise)} (à régler avec l&apos;agence)
                          </dd>
                        </div>
                      ) : null}
                      {courant.guide ? (
                        <div>
                          <dt className="inline text-gt-teal-900/75">Guide : </dt>
                          <dd className="inline font-medium">
                            {courant.guide.prenom} {courant.guide.nom}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : (
                    <p className="text-gt-teal-900/75">
                      L&apos;agence va confirmer vos dates. Vous pouvez encore les modifier.
                    </p>
                  )}
                  {courant.reponse ? <p>« {courant.reponse} »</p> : null}
                  <DepartActions
                    depart={{
                      id: courant.id,
                      statut: courant.statut,
                      dateDebut: toIsoDate(courant.dateDebut),
                      dateFin: toIsoDate(courant.dateFin),
                      nombrePersonnes: courant.nombrePersonnes,
                      remarques: courant.remarques,
                    }}
                    itineraireId={it.id}
                    dureeMinutes={it.dureeMinutes}
                    minDate={minDate}
                    peutAnnuler={courant.dateDebut.getTime() > today.getTime()}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gt-teal-900/75">
                    Itinéraire accepté : choisissez vos dates et le nombre de personnes.
                    L&apos;agence confirmera le départ.
                  </p>
                  <ProgramDepartForm
                    itineraireId={it.id}
                    dureeMinutes={it.dureeMinutes}
                    minDate={minDate}
                  />
                </div>
              )}
              {anciens.length > 0 ? (
                <ul className="mt-4 space-y-1 border-t border-gt-mist/60 pt-3 text-xs text-gt-teal-900/75">
                  {anciens.map((d) => (
                    <li key={d.id}>
                      {formatDateRange(d.dateDebut, d.dateFin)} · {d.nombrePersonnes} pers. ·{" "}
                      {d.statutLabel}
                      {d.reponse ? ` : « ${d.reponse} »` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ) : null}
          <Card title={it.origine === "AGENCE" ? "Votre réponse" : "Réponse de l'agence"}>
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
