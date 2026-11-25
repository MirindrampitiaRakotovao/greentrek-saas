import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/dashboard/widgets";
import { AnswerItineraire } from "@/components/itineraires-perso/answer-itineraire";
import { AnswerDepartForm } from "@/components/itineraires-perso/depart-sur-mesure";
import { ItineraireMap } from "@/components/itineraires-perso/itineraire-map";
import { Badge } from "@/components/ui/badge";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatDateRange, formatDateTime, formatMoney } from "@/lib/format";
import { departFormOptions } from "@/lib/services/departs";
import { listDepartsOfItineraire } from "@/lib/services/departs-sur-mesure";
import { getItineraireAgence } from "@/lib/services/itineraires-perso";

export const metadata: Metadata = { title: "Itinéraire sur mesure — Green Trek" };

/** Fiche d'un itinéraire sur mesure (back-office) : carte, chiffres, réponse à une demande. */
export default async function ItineraireAgencePage({
  params,
}: PageProps<"/dashboard/itineraires-sur-mesure/[id]">) {
  const { db } = await requireAgencyUser(["ADMIN_AGENCE", "STAFF"]);
  const { id } = await params;
  const it = await getItineraireAgence(db, id);
  if (!it) notFound();
  const demande = it.origine === "CLIENT";
  // Étape 9 : départ programmé par le voyageur.
  const [departs, options, agence] = await Promise.all([
    listDepartsOfItineraire(db, it.id),
    departFormOptions(db),
    db.agence.findFirstOrThrow({ select: { devise: true } }),
  ]);
  const courant = departs.find((d) => d.statut === "DEMANDE" || d.statut === "CONFIRME");
  const anciens = departs.filter((d) => d !== courant);

  return (
    <div className="space-y-5">
      <Link
        href="/dashboard/itineraires-sur-mesure"
        className="text-sm font-medium text-gt-teal-700 underline"
      >
        ← Itinéraires sur mesure
      </Link>
      <PageHeader
        title={it.titre}
        description={`${demande ? "Demande de" : `Proposé par ${it.auteur} à`} ${it.client} · ${formatDateTime(it.createdAt)}`}
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
            <p className="text-sm text-gt-teal-900">
              {it.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km ·{" "}
              {Math.floor(it.dureeMinutes / 60)} h {String(it.dureeMinutes % 60).padStart(2, "0")}{" "}
              de marche · {it.critere}
            </p>
            <ol className="mt-3 space-y-1 text-sm text-gt-teal-900">
              {it.etapes.map((e, i) => (
                <li key={`${e.id}-${i}`}>
                  {i + 1}. {e.nom}
                </li>
              ))}
            </ol>
            {it.message ? (
              <p className="mt-4 rounded-xl border border-gt-mist/70 p-3 text-sm text-gt-teal-900">
                « {it.message} »
              </p>
            ) : null}
            <Link
              href={`/dashboard/clients/${it.clientId}`}
              className="mt-3 inline-block text-sm font-medium text-gt-teal-700 underline"
            >
              Fiche du client
            </Link>
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
                  {courant.remarques ? <p>« {courant.remarques} »</p> : null}
                  {courant.statut === "DEMANDE" ? (
                    <AnswerDepartForm
                      id={courant.id}
                      guides={options.guides}
                      devise={agence.devise}
                    />
                  ) : (
                    <p className="text-gt-teal-900/75">
                      Confirmé le {formatDateTime(courant.reponduAt)}
                      {courant.tarif !== null
                        ? ` · ${formatMoney(courant.tarif, agence.devise)}`
                        : ""}
                      {courant.guide
                        ? ` · guide : ${courant.guide.prenom} ${courant.guide.nom}`
                        : ""}
                      {courant.reponse ? ` · « ${courant.reponse} »` : ""}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gt-teal-900/75">
                  Le voyageur n&apos;a pas encore programmé de départ.
                </p>
              )}
              {anciens.length > 0 ? (
                <ul className="mt-4 space-y-1 border-t border-gt-mist/60 pt-3 text-xs text-gt-teal-900/75">
                  {anciens.map((d) => (
                    <li key={d.id}>
                      {formatDateRange(d.dateDebut, d.dateFin)} · {d.nombrePersonnes} pers. ·{" "}
                      {d.statutLabel}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ) : null}
          <Card title={demande ? "Réponse de l'agence" : "Réponse du client"}>
            {demande && it.statut === "EN_ATTENTE" ? (
              <AnswerItineraire id={it.id} as="agence" />
            ) : it.reponduAt ? (
              <p className="text-sm text-gt-teal-900">
                {it.statutLabel} le {formatDateTime(it.reponduAt)}
                {it.reponse ? ` : « ${it.reponse} »` : "."}
              </p>
            ) : (
              <p className="text-sm text-gt-teal-900/75">En attente de la réponse du client.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
