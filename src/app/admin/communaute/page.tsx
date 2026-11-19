import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { EmptyState } from "@/components/dashboard/widgets";
import { ActionButton } from "@/components/reservations/action-button";
import {
  dismissReportAction,
  hideReportedContentAction,
  restoreReportedContentAction,
} from "@/lib/actions/communaute";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import { listCommunityReports } from "@/lib/services/communaute";

export const metadata: Metadata = { title: "Communauté — Console plateforme" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const FILTRES = [
  { value: "OUVERT", label: "À traiter" },
  { value: "TRAITE", label: "Traités" },
  { value: "tous", label: "Tous" },
] as const;

/**
 * Modération de la communauté (étape 5d, choix de l'étudiant) : le fil est commun à toutes
 * les agences, ses signalements sont donc traités par la plateforme et non par une agence.
 */
export default async function CommunauteAdminPage({
  searchParams,
}: PageProps<"/admin/communaute">) {
  await requireUser({ roles: ["SUPER_ADMIN"] });
  const params = await searchParams;
  const filtre = first(params.statut) ?? "OUVERT";
  const statut = filtre === "OUVERT" || filtre === "TRAITE" ? filtre : undefined;
  const list = await listCommunityReports(statut, parsePage(params.page));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communauté"
        description="Publications et commentaires signalés par les voyageurs. Masquer un contenu le retire du fil de toutes les agences."
      />
      <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
        {FILTRES.map((f) => {
          const active = (statut ?? "tous") === f.value;
          return (
            <Link
              key={f.value}
              href={`/admin/communaute?statut=${f.value}`}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                active
                  ? "bg-gt-teal-700 text-white"
                  : "border border-gt-mist bg-white text-gt-teal-900 hover:bg-gt-teal-50"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>
      {list.total === 0 ? (
        <EmptyState>
          {statut === "OUVERT" ? "Aucun signalement à traiter." : "Aucun signalement."}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {list.items.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gt-mist/60"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm text-gt-teal-900/75">
                  {s.cible === "PUBLICATION" ? "Publication" : "Commentaire"} signalé
                  {s.cible === "PUBLICATION" ? "e" : ""} par{" "}
                  <span className="font-medium text-gt-teal-900">{s.signalePar}</span> ·{" "}
                  {formatDateTime(s.createdAt)}
                </p>
                <span
                  className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    s.statut === "OUVERT"
                      ? "bg-gt-sand-200 text-gt-teal-900"
                      : "bg-gt-mist text-gt-teal-900"
                  }`}
                >
                  {s.statut === "OUVERT" ? "À traiter" : "Traité"}
                </span>
              </div>
              {s.motif ? (
                <p className="text-sm text-gt-teal-900">
                  <span className="font-medium">Motif :</span> {s.motif}
                </p>
              ) : null}
              {s.contenu ? (
                <div className="space-y-2 rounded-2xl bg-gt-teal-50 p-4 text-sm text-gt-teal-900">
                  <p className="text-xs font-semibold">
                    {s.contenu.auteur}
                    {s.contenu.statut === "MASQUE" ? " · masqué" : ""}
                  </p>
                  {s.contenu.photos.length ? (
                    <div className="flex gap-2">
                      {s.contenu.photos.map((src, i) => (
                        // eslint-disable-next-line @next/next/no-img-element -- images envoyées, déjà réduites
                        <img
                          key={src}
                          src={src}
                          alt={`Photo ${i + 1} du contenu signalé`}
                          className="size-20 rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  ) : null}
                  {s.contenu.texte ? (
                    <p className="whitespace-pre-line">{s.contenu.texte}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-gt-teal-900/75 italic">
                  Contenu supprimé par son auteur.
                </p>
              )}
              <div className="mt-auto flex flex-wrap justify-end gap-2">
                {s.contenu?.statut === "MASQUE" ? (
                  <ActionButton
                    id={s.id}
                    label="Rétablir"
                    size="sm"
                    variant="secondary"
                    action={restoreReportedContentAction}
                  />
                ) : null}
                {s.statut === "OUVERT" ? (
                  <>
                    <ActionButton
                      id={s.id}
                      label="Classer sans suite"
                      size="sm"
                      variant="secondary"
                      action={dismissReportAction}
                    />
                    {s.contenu && s.contenu.statut !== "MASQUE" ? (
                      <ActionButton
                        id={s.id}
                        label="Masquer"
                        size="sm"
                        variant="danger"
                        action={hideReportedContentAction}
                        confirmMessage="Masquer ce contenu ? Il disparaîtra du fil de toutes les agences."
                      />
                    ) : null}
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        basePath="/admin/communaute"
        page={list.page}
        pageCount={list.pageCount}
        params={{ statut: statut ?? "tous" }}
      />
    </div>
  );
}
