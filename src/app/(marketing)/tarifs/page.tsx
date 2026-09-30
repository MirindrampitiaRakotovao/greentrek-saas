import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { BlurBlobs } from "@/components/vitrine/blur-blobs";
import { formatMoney } from "@/lib/format";
import { TRIAL_DAYS } from "@/lib/services/onboarding";
import { listActivePlans, planFeatures } from "@/lib/services/plateforme";

// Plans lus en base à chaque visite : une modification du super admin s'affiche aussitôt.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tarifs — Green Trek",
  description: "Plans de la plateforme Green Trek (tarifs fictifs de démonstration).",
};

/**
 * Plans et tarifs (§7.5, hypothèse §16.1 : tarifs FICTIFS), lus en base : seuls les plans
 * actifs sont proposés (un plan désactivé par le super admin disparaît de cette page).
 */
export default async function TarifsPage() {
  const plans = await listActivePlans();
  // Plan mis en avant : le plan payant le moins cher.
  const highlighted = plans.find((p) => p.prixMensuel > 0)?.id;

  return (
    <div className="relative isolate mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <BlurBlobs preset="corners" />
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold tracking-wide text-gt-teal-600 uppercase">Tarifs</p>
        <h1 className="mt-2 text-4xl font-medium text-gt-teal-900 sm:text-5xl">
          Un plan pour chaque agence
        </h1>
        <p className="mt-4 text-gt-teal-900/70">
          Toutes les agences commencent par un essai gratuit de {TRIAL_DAYS} jours. Tarifs fictifs :
          projet de démonstration, aucune facturation réelle.
        </p>
      </div>

      <ul className="mt-12 grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const featured = plan.id === highlighted;
          return (
            <li
              key={plan.id}
              className={`relative flex flex-col rounded-3xl p-7 ${
                featured
                  ? "bg-gt-teal-900 text-white shadow-2xl shadow-gt-teal-900/30 lg:-my-3"
                  : "bg-white text-gt-teal-900 shadow-md ring-1 ring-gt-mist/60"
              }`}
            >
              {featured ? (
                <span className="absolute -top-3 left-7 rounded-full bg-gt-sand-300 px-3 py-1 text-xs font-semibold text-gt-teal-900">
                  Recommandé
                </span>
              ) : null}
              <h2 className={`text-xl font-medium ${featured ? "text-gt-cream" : ""}`}>
                {plan.nom}
              </h2>
              <p className="mt-4">
                <span className="text-4xl font-semibold">
                  {plan.prixMensuel === 0 ? "Gratuit" : formatMoney(plan.prixMensuel, "MGA")}
                </span>
                {plan.prixMensuel > 0 ? (
                  <span className={featured ? "text-white/70" : "text-gt-teal-900/60"}>
                    {" "}
                    / mois
                  </span>
                ) : (
                  <span className={featured ? "text-white/70" : "text-gt-teal-900/60"}>
                    {" "}
                    pendant {TRIAL_DAYS} jours
                  </span>
                )}
              </p>
              <ul
                className={`mt-6 space-y-2 text-sm ${featured ? "text-white/90" : "text-gt-teal-900/80"}`}
              >
                {[
                  `${plan.maxCircuits} circuits`,
                  `${plan.maxUtilisateurs} comptes du personnel`,
                  `${plan.maxSessionsActives} départs actifs`,
                  ...planFeatures(plan.fonctionnalites),
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <Icon
                      name="check"
                      className={`mt-0.5 size-4 ${featured ? "text-gt-sand-300" : "text-gt-teal-600"}`}
                    />
                    {line}
                  </li>
                ))}
              </ul>
              {/* Bouton en bas de la carte, toujours séparé de la liste. */}
              <div className="mt-auto pt-8">
                <Link
                  href="/inscription-agence"
                  className={`block rounded-full px-5 py-3 text-center text-sm font-semibold ${
                    featured
                      ? "bg-gt-sand-300 text-gt-teal-900 hover:bg-gt-sand-200"
                      : "bg-gt-teal-700 text-white hover:bg-gt-teal-800"
                  }`}
                >
                  {plan.prixMensuel === 0 ? "Commencer l'essai" : "Commencer par l'essai"}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-10 text-center text-sm text-gt-teal-900/65">
        Après l&apos;essai, le plan est attribué par l&apos;administrateur de la plateforme. Limites
        appliquées à la création des circuits, des comptes et des départs.
      </p>
    </div>
  );
}
