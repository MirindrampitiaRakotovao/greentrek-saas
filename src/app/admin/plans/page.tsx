import type { Metadata } from "next";
import Link from "next/link";

import { PlanActifButton, PlanForm } from "@/components/admin/admin-controls";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { FormModal } from "@/components/ui/form-modal";
import { requireUser } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import { listPlans, planFeatures } from "@/lib/services/plateforme";

export const metadata: Metadata = { title: "Plans et tarifs — Console Green Trek" };

/**
 * Plans FICTIFS de la plateforme (§7.4, hypothèse §16.1) : création, modification,
 * activation. Pas de suppression d'un plan (décision E) : désactivé, il n'est plus proposé.
 */
export default async function PlansPage() {
  await requireUser({ roles: ["SUPER_ADMIN"] });
  const plans = await listPlans();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans et tarifs"
        description="Plans proposés aux agences et affichés sur la page publique Tarifs."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/tarifs"
              className="rounded-full border border-gt-teal-700 px-4 py-2.5 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50"
            >
              Voir la page Tarifs
            </Link>
            <FormModal triggerLabel="Nouveau plan" title="Nouveau plan" icon="coins" size="lg">
              <PlanForm devise="MGA" />
            </FormModal>
          </div>
        }
      />
      <div className="gt-table-wrap">
        <table className="gt-table min-w-[900px]">
          <caption className="sr-only">Plans</caption>
          <thead>
            <tr>
              {[
                "Plan",
                "Prix mensuel",
                "Circuits",
                "Personnel",
                "Départs actifs",
                "Abonnements",
                "Statut",
                "",
              ].map((h, i) => (
                <th key={`${h}-${i}`} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => {
              const features = planFeatures(plan.fonctionnalites);
              return (
                <tr key={plan.id} className={plan.actif ? "" : "text-gt-teal-900/55"}>
                  <td>
                    <p className="font-medium">{plan.nom}</p>
                    <p className="font-mono text-xs text-gt-teal-900/55">{plan.code}</p>
                  </td>
                  <td className="whitespace-nowrap">{formatMoney(plan.prixMensuel, "MGA")}</td>
                  <td>{plan.maxCircuits}</td>
                  <td>{plan.maxUtilisateurs}</td>
                  <td>{plan.maxSessionsActives}</td>
                  <td>{plan._count.abonnements}</td>
                  <td>
                    <Badge tone={plan.actif ? "success" : "neutral"}>
                      {plan.actif ? "Proposé" : "Désactivé"}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <FormModal
                        triggerLabel="Modifier"
                        triggerIcon="pencil"
                        variant="ghost"
                        title={`Plan ${plan.nom}`}
                        description={`${plan._count.abonnements} abonnement(s) ; les limites modifiées s'appliquent aussitôt.`}
                        icon="coins"
                        size="lg"
                      >
                        <PlanForm
                          devise="MGA"
                          plan={{
                            id: plan.id,
                            code: plan.code,
                            nom: plan.nom,
                            prixMensuel: plan.prixMensuel,
                            maxCircuits: plan.maxCircuits,
                            maxUtilisateurs: plan.maxUtilisateurs,
                            maxSessionsActives: plan.maxSessionsActives,
                            fonctionnalites: features,
                          }}
                        />
                      </FormModal>
                      <PlanActifButton id={plan.id} nom={plan.nom} actif={plan.actif} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
