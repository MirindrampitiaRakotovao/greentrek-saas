import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AgenceStatutButton, AssignPlanForm } from "@/components/admin/admin-controls";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, ProgressBar } from "@/components/dashboard/widgets";
import { Badge } from "@/components/ui/badge";
import { FormModal } from "@/components/ui/form-modal";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatMoney, formatShortDate } from "@/lib/format";
import { LIMIT_LABELS, limitFor, type LimitKind, STATUT_ABONNEMENT_LABELS } from "@/lib/plans";
import { getAgence, listActivePlans } from "@/lib/services/plateforme";

export const metadata: Metadata = { title: "Agence — Console Green Trek" };

const KINDS: readonly LimitKind[] = ["circuits", "utilisateurs", "departs"];

/** Fiche d'une agence (§7.4) : suspension (RG 19), plan, utilisation (RG 18), historique. */
export default async function AgencePage({ params }: PageProps<"/admin/agences/[id]">) {
  await requireUser({ roles: ["SUPER_ADMIN"] });
  const { id } = await params;
  const [agence, plans] = await Promise.all([getAgence(id), listActivePlans()]);
  if (!agence) notFound();
  const sub = agence.subscription;

  return (
    <div className="space-y-6">
      <Link href="/admin/agences" className="text-sm font-medium text-gt-teal-700 underline">
        ← Retour aux agences
      </Link>
      <PageHeader
        title={agence.nom}
        description={`/a/${agence.slug} · inscrite le ${formatDate(agence.createdAt)}${agence.ville ? ` · ${agence.ville}` : ""}`}
        actions={
          <Badge tone={agence.statut === "ACTIVE" ? "success" : "danger"}>
            {agence.statut === "ACTIVE" ? "Active" : "Suspendue"}
          </Badge>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Abonnement" className="min-w-0">
          {sub ? (
            <>
              <p className="text-2xl font-semibold text-gt-teal-900">{sub.plan.nom}</p>
              <p className="text-sm text-gt-teal-900/75">
                {STATUT_ABONNEMENT_LABELS[sub.statut]} · depuis le {formatShortDate(sub.dateDebut)}
                {sub.dateFin ? ` · jusqu'au ${formatShortDate(sub.dateFin)}` : " · sans échéance"}
              </p>
              <ul className="mt-4 space-y-3">
                {KINDS.map((kind) => {
                  const max = limitFor(sub.plan, kind);
                  return (
                    <li key={kind}>
                      <div className="mb-1 flex justify-between text-xs text-gt-teal-900/75">
                        <span className="first-letter:uppercase">{LIMIT_LABELS[kind].pluriel}</span>
                        <span className="font-semibold text-gt-teal-900">
                          {agence.usage[kind]} / {max}
                        </span>
                      </div>
                      <ProgressBar
                        value={agence.usage[kind]}
                        max={max}
                        label={`${LIMIT_LABELS[kind].pluriel} : ${agence.usage[kind]} sur ${max}`}
                      />
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="text-sm text-gt-teal-900/75">
              Aucun abonnement : pas de limite appliquée (décision C de l&apos;étape E11).
            </p>
          )}
          <div className="mt-5">
            <FormModal
              triggerLabel="Attribuer un plan"
              triggerIcon="coins"
              variant="secondary"
              title="Attribuer un plan"
              description={agence.nom}
            >
              <AssignPlanForm
                agenceId={agence.id}
                plans={plans.map((p) => ({
                  id: p.id,
                  nom: p.nom,
                  prix: `${formatMoney(p.prixMensuel, "MGA")} / mois`,
                }))}
              />
            </FormModal>
          </div>
        </Card>

        <Card title="Activité" className="min-w-0">
          <dl className="grid grid-cols-2 gap-4">
            {[
              ["Circuits", agence._count.circuits],
              ["Départs", agence._count.sessionsDepart],
              ["Réservations", agence._count.reservations],
              ["Clients", agence._count.utilisateurs],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-gt-teal-900/75">{label}</dt>
                <dd className="text-2xl font-semibold text-gt-teal-900">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-gt-teal-900/75">
            {[agence.email, agence.telephone].filter(Boolean).join(" · ") ||
              "Coordonnées non renseignées"}
          </p>
        </Card>

        <Card title="Accès" className="min-w-0">
          <p className="mb-4 text-sm text-gt-teal-900/75">
            {agence.statut === "ACTIVE"
              ? "La suspension coupe immédiatement l'accès de l'équipe et des clients, et retire le site vitrine (RG 19). Aucune donnée n'est supprimée."
              : "Agence suspendue : ni son équipe ni ses clients ne peuvent se connecter, son site vitrine est introuvable."}
          </p>
          <AgenceStatutButton id={agence.id} nom={agence.nom} statut={agence.statut} />
        </Card>
      </div>

      <Card title={`Historique des abonnements (${agence.abonnements.length})`}>
        {agence.abonnements.length === 0 ? (
          <p className="text-sm text-gt-teal-900/75">Aucun abonnement.</p>
        ) : (
          <div className="gt-table-wrap">
            <table className="gt-table min-w-[560px]">
              <caption className="sr-only">Historique des abonnements</caption>
              <thead>
                <tr>
                  {["Plan", "Statut", "Début", "Fin", "Prix mensuel"].map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agence.abonnements.map((a) => (
                  <tr key={a.id}>
                    <td className="font-medium">{a.plan.nom}</td>
                    <td>{STATUT_ABONNEMENT_LABELS[a.statut]}</td>
                    <td>{formatShortDate(a.dateDebut)}</td>
                    <td>{a.dateFin ? formatShortDate(a.dateFin) : "Sans échéance"}</td>
                    <td>{formatMoney(a.plan.prixMensuel, "MGA")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
