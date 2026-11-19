import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { EmptyState } from "@/components/dashboard/widgets";
import { ActionButton } from "@/components/reservations/action-button";
import { deactivateClientAction, treatSignalementAction } from "@/lib/actions/voyageurs";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { listSignalements } from "@/lib/services/voyageurs";

export const metadata: Metadata = { title: "Signalements — Green Trek" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const FILTRES = [
  { value: "OUVERT", label: "À traiter" },
  { value: "TRAITE", label: "Traités" },
  { value: "tous", label: "Tous" },
] as const;

/**
 * Messages signalés par les voyageurs (étape 5c). L'agence ne lit pas les conversations entre
 * voyageurs : elle ne voit que le message signalé. L'administrateur peut désactiver le compte
 * de l'auteur en cas d'abus.
 */
export default async function SignalementsPage({
  searchParams,
}: PageProps<"/dashboard/signalements">) {
  const { user, db } = await requireAgencyUser(["ADMIN_AGENCE", "STAFF"]);
  const params = await searchParams;
  const filtre = first(params.statut) ?? "OUVERT";
  const statut = filtre === "OUVERT" || filtre === "TRAITE" ? filtre : undefined;
  const list = await listSignalements(db, statut, parsePage(params.page));
  const peutDesactiver = can(user.role, "modifier", "utilisateur");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Signalements"
        description="Messages que des voyageurs vous ont signalés dans leurs conversations privées. Vous ne voyez que le message signalé."
      />
      <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
        {FILTRES.map((f) => {
          const active = (statut ?? "tous") === f.value;
          return (
            <Link
              key={f.value}
              href={`/dashboard/signalements?statut=${f.value}`}
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
                  Signalé par <span className="font-medium text-gt-teal-900">{s.signalePar}</span> ·{" "}
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
                <blockquote className="rounded-2xl bg-gt-teal-50 p-4 text-sm whitespace-pre-line text-gt-teal-900">
                  <p className="mb-1 text-xs font-semibold">
                    {s.contenu.auteur.prenom} {s.contenu.auteur.nom}
                    {s.contenu.auteur.actif ? "" : " (compte désactivé)"} ·{" "}
                    {formatDateTime(s.contenu.createdAt)}
                  </p>
                  {s.contenu.contenu}
                </blockquote>
              ) : (
                <p className="text-sm text-gt-teal-900/75 italic">Message supprimé.</p>
              )}
              <div className="mt-auto flex flex-wrap justify-end gap-2">
                {peutDesactiver && s.contenu?.auteur.actif ? (
                  <ActionButton
                    id={s.contenu.auteur.id}
                    label="Désactiver le compte"
                    size="sm"
                    variant="danger"
                    action={deactivateClientAction}
                    confirmMessage={`Désactiver le compte de ${s.contenu.auteur.prenom} ${s.contenu.auteur.nom} ? Ce voyageur ne pourra plus se connecter.`}
                  />
                ) : null}
                {s.statut === "OUVERT" ? (
                  <ActionButton
                    id={s.id}
                    label="Marquer comme traité"
                    size="sm"
                    action={treatSignalementAction}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        basePath="/dashboard/signalements"
        page={list.page}
        pageCount={list.pageCount}
        params={{ statut: statut ?? "tous" }}
      />
    </div>
  );
}
