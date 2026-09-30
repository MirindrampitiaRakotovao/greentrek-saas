import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { Card, EmptyState, ProgressBar } from "@/components/dashboard/widgets";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatDate, formatMoney } from "@/lib/format";
import {
  isUsable,
  LIMIT_LABELS,
  limitFor,
  type LimitKind,
  STATUT_ABONNEMENT_LABELS,
} from "@/lib/plans";
import { getCurrentSubscription, getUsage } from "@/lib/services/abonnements";
import { planFeatures } from "@/lib/services/plateforme";

export const metadata: Metadata = { title: "Abonnement — Green Trek" };

const KINDS: readonly LimitKind[] = ["circuits", "utilisateurs", "departs"];

/**
 * Abonnement de l'agence (§7.3, P1) : plan actuel et limites d'usage (RG 18), en lecture
 * (décision D de l'étape E11 : le plan est attribué par l'administrateur de la plateforme).
 */
export default async function AbonnementPage() {
  const { db } = await requireAgencyUser(["ADMIN_AGENCE"]);
  const [sub, usage] = await Promise.all([getCurrentSubscription(db), getUsage(db)]);

  if (!sub) {
    return (
      <div className="space-y-6">
        <PageHeader title="Abonnement" />
        <EmptyState>
          Aucun abonnement enregistré pour votre agence : aucune limite ne s&apos;applique.
        </EmptyState>
      </div>
    );
  }
  const actif = isUsable(sub.statut);
  const features = planFeatures(sub.plan.fonctionnalites);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abonnement"
        actions={
          <Link
            href="/tarifs"
            className="rounded-full border border-gt-teal-700 px-4 py-2.5 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50"
          >
            Comparer les plans
          </Link>
        }
      />

      {!actif ? (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-900 ring-1 ring-red-200"
        >
          Votre abonnement est {sub.statut === "EXPIRE" ? "expiré" : "annulé"} : vous ne pouvez plus
          créer de circuits, de comptes ni de départs. Vos données, votre site et vos réservations
          restent accessibles. Contactez l&apos;administrateur de la plateforme pour choisir un
          plan.
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Plan actuel" className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-3xl font-semibold text-gt-teal-900">{sub.plan.nom}</p>
            <Badge tone={actif ? "success" : "danger"}>
              {STATUT_ABONNEMENT_LABELS[sub.statut]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gt-teal-900/75">
            {formatMoney(sub.plan.prixMensuel, "MGA")} par mois
          </p>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gt-teal-900/75">Début</dt>
              <dd>{formatDate(sub.dateDebut)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gt-teal-900/75">Fin</dt>
              <dd>{sub.dateFin ? formatDate(sub.dateFin) : "Sans échéance"}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Utilisation (RG 18)" className="min-w-0 lg:col-span-2">
          <ul className="space-y-4">
            {KINDS.map((kind) => {
              const max = limitFor(sub.plan, kind);
              const used = usage[kind];
              return (
                <li key={kind}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="text-gt-teal-900/80 first-letter:uppercase">
                      {LIMIT_LABELS[kind].pluriel}
                    </span>
                    <span className="font-semibold text-gt-teal-900">
                      {used} / {max}
                      {used >= max ? (
                        <span className="ml-2 text-xs font-semibold text-red-700">
                          limite atteinte
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <ProgressBar
                    value={used}
                    max={max}
                    label={`${LIMIT_LABELS[kind].pluriel} : ${used} sur ${max}`}
                  />
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-gt-teal-900/75">
            Comptés : circuits non archivés, comptes du personnel actifs (les clients ne comptent
            pas), départs ouverts ou complets pas encore terminés.
          </p>
        </Card>
      </div>

      {features.length > 0 ? (
        <Card title="Inclus dans votre plan">
          <ul className="grid gap-2 sm:grid-cols-2">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-gt-teal-900">
                <Icon name="check" className="size-4 text-gt-teal-600" />
                {f}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
