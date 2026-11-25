import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { EmptyState } from "@/components/dashboard/widgets";
import { Badge } from "@/components/ui/badge";
import type { StatutItineraire } from "@/generated/prisma/client";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatDateRange, formatDateTime } from "@/lib/format";
import { listUpcomingDepartsSurMesure } from "@/lib/services/departs-sur-mesure";
import { parsePage } from "@/lib/pagination";
import { listItinerairesAgence, STATUT_ITINERAIRE_LABELS } from "@/lib/services/itineraires-perso";

export const metadata: Metadata = { title: "Itinéraires sur mesure — Green Trek" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const ORIGINES = { CLIENT: "Demandes des voyageurs", AGENCE: "Propositions de l'agence" } as const;
const STATUTS = ["EN_ATTENTE", "ACCEPTE", "DECLINE"] as const;

/** Itinéraires sur mesure de l'agence (après E12) : demandes des voyageurs et propositions. */
export default async function ItinerairesSurMesurePage({
  searchParams,
}: PageProps<"/dashboard/itineraires-sur-mesure">) {
  const { db } = await requireAgencyUser(["ADMIN_AGENCE", "STAFF"]);
  const params = await searchParams;
  const origineParam = first(params.origine);
  const origine = origineParam === "CLIENT" || origineParam === "AGENCE" ? origineParam : undefined;
  const statutParam = first(params.statut);
  const statut = STATUTS.find((s) => s === statutParam) as StatutItineraire | undefined;
  const page = parsePage(params.page);
  const [list, departs] = await Promise.all([
    listItinerairesAgence(db, { origine, statut }, page),
    listUpcomingDepartsSurMesure(db),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Itinéraires sur mesure"
        description="Demandes envoyées par les voyageurs et itinéraires proposés par l'agence à ses clients."
      />
      {departs.length > 0 ? (
        <section aria-labelledby="titre-departs-sur-mesure" className="gt-table-wrap">
          <h2
            id="titre-departs-sur-mesure"
            className="px-5 pt-4 text-base font-semibold text-gt-teal-900"
          >
            Départs sur mesure à venir
          </h2>
          <ul className="divide-y divide-gt-mist/60 px-5 pb-2">
            {departs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/itineraires-sur-mesure/${d.itineraireId}`}
                    className="font-medium text-gt-teal-700 underline"
                  >
                    {d.itineraire.titre}
                  </Link>
                  <p className="text-xs text-gt-teal-900/75">
                    {d.itineraire.client.prenom} {d.itineraire.client.nom} ·{" "}
                    {formatDateRange(d.dateDebut, d.dateFin)} · {d.nombrePersonnes} pers.
                    {d.guide ? ` · guide : ${d.guide.prenom} ${d.guide.nom}` : ""}
                  </p>
                </div>
                <Badge tone={d.statut === "CONFIRME" ? "success" : "sand"}>{d.statutLabel}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <form method="get" className="flex flex-wrap gap-2">
        <label htmlFor="it-origine" className="sr-only">
          Origine
        </label>
        <select
          id="it-origine"
          name="origine"
          defaultValue={origine ?? ""}
          className="rounded-full border border-gt-mist bg-white px-4 py-2 text-sm text-gt-teal-900"
        >
          <option value="">Toutes les origines</option>
          {(["CLIENT", "AGENCE"] as const).map((o) => (
            <option key={o} value={o}>
              {ORIGINES[o]}
            </option>
          ))}
        </select>
        <label htmlFor="it-statut" className="sr-only">
          Statut
        </label>
        <select
          id="it-statut"
          name="statut"
          defaultValue={statut ?? ""}
          className="rounded-full border border-gt-mist bg-white px-4 py-2 text-sm text-gt-teal-900"
        >
          <option value="">Tous les statuts</option>
          {STATUTS.map((s) => (
            <option key={s} value={s}>
              {STATUT_ITINERAIRE_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full border border-gt-teal-700 px-4 py-2 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50"
        >
          Filtrer
        </button>
      </form>

      {list.total === 0 ? (
        <EmptyState>Aucun itinéraire ne correspond.</EmptyState>
      ) : (
        <div className="gt-table-wrap">
          <table className="gt-table min-w-[820px]">
            <caption className="sr-only">Itinéraires sur mesure</caption>
            <thead>
              <tr>
                {["Itinéraire", "Client", "Origine", "Distance", "Statut", "Date"].map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <Link
                      href={`/dashboard/itineraires-sur-mesure/${it.id}`}
                      className="font-medium text-gt-teal-700 underline"
                    >
                      {it.titre}
                    </Link>
                    <p className="text-xs text-gt-teal-900/75">
                      {it.depart} – {it.arrivee}
                    </p>
                  </td>
                  <td>
                    <Link href={`/dashboard/clients/${it.clientId}`} className="underline">
                      {it.client}
                    </Link>
                  </td>
                  <td>{it.origine === "CLIENT" ? "Demande du voyageur" : "Proposition"}</td>
                  <td className="whitespace-nowrap">
                    {it.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km
                  </td>
                  <td>
                    <Badge
                      tone={
                        it.statut === "ACCEPTE"
                          ? "success"
                          : it.statut === "DECLINE"
                            ? "danger"
                            : "sand"
                      }
                    >
                      {it.statutLabel}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap">{formatDateTime(it.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        basePath="/dashboard/itineraires-sur-mesure"
        page={list.page}
        pageCount={list.pageCount}
        params={{ origine, statut }}
      />
    </div>
  );
}
