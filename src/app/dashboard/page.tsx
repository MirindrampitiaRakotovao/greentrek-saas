import type { Metadata } from "next";
import Link from "next/link";

import { AgencyDashboardView } from "@/components/dashboard/agency-dashboard-view";
import { GuideDashboardView } from "@/components/dashboard/guide-dashboard-view";
import { requireAgencyUser } from "@/lib/auth/session";
import { getAgencyDashboard } from "@/lib/dashboard/agency";
import { getGuideDashboard } from "@/lib/dashboard/guide";
import { can } from "@/lib/permissions";
import { countATraiter } from "@/lib/services/gestion-reservations";

export const metadata: Metadata = { title: "Tableau de bord — Green Trek" };

/**
 * Accueil du back-office. Indicateurs calculés en direct sur la base, via le client confiné
 * à l'agence. Le guide a sa propre vue (ses départs uniquement, matrice §3).
 */
export default async function DashboardPage() {
  const { user, db } = await requireAgencyUser();
  const now = new Date();

  if (user.role === "GUIDE") {
    return <GuideDashboardView data={await getGuideDashboard(db, user.id, now)} />;
  }

  const [data, aTraiter, avisAModerer] = await Promise.all([
    getAgencyDashboard(db, user.agenceId, now),
    countATraiter(db, now),
    db.avis.count({ where: { statut: "EN_ATTENTE" } }),
  ]);
  const items = [
    {
      n: aTraiter.enAttente,
      label: "réservation(s) en attente",
      href: "/dashboard/reservations?statut=EN_ATTENTE&periode=a-venir",
    },
    {
      n: aTraiter.paiementsAValider,
      label: "paiement(s) à valider",
      href: "/dashboard/paiements?statut=EN_ATTENTE",
    },
    {
      n: aTraiter.aRegulariser,
      label: "à régulariser",
      href: "/dashboard/reservations?statut=EN_ATTENTE&periode=tous",
    },
    {
      n: aTraiter.aRembourser,
      label: "à rembourser",
      href: "/dashboard/reservations?statut=ANNULEE&periode=tous",
    },
    { n: avisAModerer, label: "avis à modérer", href: "/dashboard/avis" },
  ].filter((item) => item.n > 0);
  return (
    <div className="space-y-5">
      {items.length > 0 ? (
        <nav
          aria-label="À traiter"
          className="flex flex-wrap items-center gap-2 rounded-2xl bg-gt-sand-200/60 px-4 py-3 text-sm ring-1 ring-gt-sand-300"
        >
          <span className="font-semibold text-gt-teal-900">À traiter :</span>
          {items.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              className="rounded-full bg-white px-3 py-1 font-medium text-gt-teal-800 ring-1 ring-gt-mist hover:bg-gt-teal-50"
            >
              {item.n} {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
      <AgencyDashboardView
        data={data}
        now={now}
        showSubscription={can(user.role, "lire", "abonnement")}
      />
    </div>
  );
}
