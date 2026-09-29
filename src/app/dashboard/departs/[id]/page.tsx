import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DepartActions } from "@/components/departs/depart-actions";
import { DepartForm } from "@/components/departs/depart-form";
import { FormModal } from "@/components/ui/form-modal";
import { DepartStatusBadge } from "@/components/departs/depart-status-badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, EmptyState, ProgressBar, StatusPill } from "@/components/dashboard/widgets";
import { requireAgencyUser } from "@/lib/auth/session";
import { calendarDate } from "@/lib/dates";
import { toIsoDate } from "@/lib/departs";
import { formatDateRange, formatDateTime, formatMoney } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getAgencySettings } from "@/lib/services/agency-settings";
import { findGuideFiche, getDepart } from "@/lib/services/departs";

export const metadata: Metadata = { title: "Départ — Green Trek" };

/** Fiche d'un départ : remplissage, réservations et participants, modification, annulation. */
export default async function DepartPage({ params }: PageProps<"/dashboard/departs/[id]">) {
  const { user, db } = await requireAgencyUser();
  const { id } = await params;
  // Client confiné : un départ d'une autre agence donne une page 404.
  const [depart, settings] = await Promise.all([
    getDepart(db, id),
    getAgencySettings(db, user.agenceId),
  ]);
  if (!depart) notFound();
  // Un GUIDE ne consulte que les départs qu'il encadre (matrice §3).
  if (user.role === "GUIDE") {
    const fiche = await findGuideFiche(db, user.id);
    if (!fiche || depart.guideId !== fiche.id) notFound();
  }

  const modifiable = depart.statut === "OUVERTE" || depart.statut === "COMPLETE";
  const canEdit = modifiable && can(user.role, "modifier", "sessionDepart");
  const actives = depart.reservations.filter((r) => r.statut !== "ANNULEE");
  const guides = canEdit
    ? await db.guide.findMany({
        // Guides actifs, plus le guide déjà affecté s'il a été désactivé depuis.
        where: { OR: [{ actif: true }, ...(depart.guideId ? [{ id: depart.guideId }] : [])] },
        orderBy: [{ nom: "asc" }, { prenom: "asc" }],
        select: { id: true, prenom: true, nom: true },
      })
    : [];
  const participants = actives.flatMap((r) =>
    r.participants.map((p) => ({ ...p, reference: r.reference })),
  );

  return (
    <div className="space-y-6">
      <Link href="/dashboard/departs" className="text-sm font-medium text-gt-teal-700 underline">
        ← Retour aux départs
      </Link>
      <PageHeader
        title={formatDateRange(depart.dateDebut, depart.dateFin)}
        description={`${depart.circuit.titre} · ${formatMoney(depart.prix, settings.devise)} / pers.${depart.prixParPersonne !== null ? " (prix spécifique)" : ""}`}
        actions={<DepartStatusBadge statut={depart.statut} />}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Remplissage" className="min-w-0">
          <p className="mb-2 text-3xl font-semibold text-gt-teal-900">
            {depart.reservees}
            <span className="text-base font-normal text-gt-teal-900/60">
              {" "}
              / {depart.placesTotal} places
            </span>
          </p>
          <ProgressBar
            value={depart.reservees}
            max={depart.placesTotal}
            label={`Remplissage : ${depart.reservees} sur ${depart.placesTotal} places`}
          />
          <p className="mt-2 text-sm text-gt-teal-900/70">
            {Math.max(0, depart.placesTotal - depart.reservees)} place(s) libre(s) ·{" "}
            {actives.length} réservation(s) active(s)
          </p>
        </Card>
        <Card title="Encadrement" className="min-w-0">
          {depart.guide ? (
            <>
              <p className="font-medium text-gt-teal-900">
                {depart.guide.prenom} {depart.guide.nom}
              </p>
              <p className="text-sm text-gt-teal-900/70">{depart.guide.telephone ?? "—"}</p>
            </>
          ) : (
            <p className="text-sm text-gt-teal-900/70">Aucun guide affecté.</p>
          )}
        </Card>
        <Card title="Circuit" className="min-w-0">
          {user.role === "GUIDE" ? (
            <p className="font-medium text-gt-teal-900">{depart.circuit.titre}</p>
          ) : (
            <Link
              href={`/dashboard/circuits/${depart.circuit.id}`}
              className="font-medium text-gt-teal-700 underline"
            >
              {depart.circuit.titre}
            </Link>
          )}
          <p className="text-sm text-gt-teal-900/70">
            {depart.circuit.dureeJours} jour(s) · capacité {depart.circuit.capaciteMax} pers.
          </p>
          {depart.notes ? (
            <p className="mt-2 text-sm whitespace-pre-line text-gt-teal-900/80">{depart.notes}</p>
          ) : null}
        </Card>
      </div>

      <Card title={`Réservations (${depart.reservations.length})`}>
        {depart.reservations.length === 0 ? (
          <EmptyState>
            Aucune réservation pour l&apos;instant. Les clients réserveront depuis le site vitrine
            (étape E9).
          </EmptyState>
        ) : (
          <div className="relative -mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Réservations de ce départ</caption>
              <thead className="text-xs text-gt-teal-900/55">
                <tr className="border-b border-gt-mist/70">
                  {["Référence", "Client", "Personnes", "Montant", "Réservée le", "Statut"].map(
                    (h) => (
                      <th key={h} scope="col" className="py-2 pr-3 font-medium">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gt-mist/60">
                {depart.reservations.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 pr-3 font-mono text-xs">{r.reference}</td>
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-gt-teal-900">
                        {r.client.prenom} {r.client.nom}
                      </p>
                      <p className="text-xs text-gt-teal-900/60">
                        {r.client.telephone ?? r.client.email}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3">{r.nombrePersonnes}</td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      {formatMoney(r.montantTotal, settings.devise)}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-gt-teal-900/75">
                      {formatDateTime(r.createdAt)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <StatusPill statut={r.statut} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Participants (${participants.length})`}>
        {participants.length === 0 ? (
          <EmptyState>
            Aucun participant détaillé : la saisie des participants arrive avec le tunnel de
            réservation (étape E9).
          </EmptyState>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {participants.map((p) => (
              <li key={p.id} className="rounded-xl border border-gt-mist/70 px-3 py-2 text-sm">
                <p className="font-medium text-gt-teal-900">
                  {p.prenom} {p.nom}
                </p>
                <p className="text-xs text-gt-teal-900/60">
                  {[p.age !== null ? `${p.age} ans` : null, p.nationalite, p.reference]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canEdit ? (
        <Card title="Gestion du départ">
          <p className="mb-4 text-sm text-gt-teal-900/70">
            Modifier les dates, les places, le prix ou le guide. Annuler le départ annule aussi ses
            réservations actives (remboursements depuis la fiche de chaque réservation).
          </p>
          <div className="flex flex-wrap items-start gap-3">
            <FormModal
              triggerLabel="Modifier le départ"
              triggerIcon="pencil"
              title="Modifier le départ"
              description={`${depart.circuit.titre} · ${formatDateRange(depart.dateDebut, depart.dateFin)}`}
              icon="calendar"
            >
              <DepartForm
                circuits={[]}
                guides={guides.map((g) => ({ id: g.id, label: `${g.prenom} ${g.nom}` }))}
                devise={settings.devise}
                today={toIsoDate(calendarDate(new Date()))}
                depart={{
                  id: depart.id,
                  circuitId: depart.circuit.id,
                  dateDebut: depart.dateDebut,
                  dateFin: depart.dateFin,
                  placesTotal: depart.placesTotal,
                  prixParPersonne: depart.prixParPersonne,
                  guideId: depart.guideId,
                  notes: depart.notes,
                  reservees: depart.reservees,
                }}
              />
            </FormModal>
            <DepartActions
              id={depart.id}
              reservationsActives={actives.length}
              canCancel
              canDelete={
                can(user.role, "supprimer", "sessionDepart") && depart.reservations.length === 0
              }
            />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
