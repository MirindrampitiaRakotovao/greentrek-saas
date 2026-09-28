import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { requireAgencyUser } from "@/lib/auth/session";
import { navigationFor } from "@/lib/navigation";
import { ROLE_LABELS } from "@/lib/roles";

export const metadata: Metadata = { title: "Tableau de bord — Green Trek" };

/** Accueil du back-office. Les indicateurs (KPIs, graphiques) arrivent à l'étape E10. */
export default async function DashboardPage() {
  const { user, db } = await requireAgencyUser();
  const [agence, equipe] = await Promise.all([
    db.agence.findUniqueOrThrow({ where: { id: user.agenceId }, select: { nom: true } }),
    db.utilisateur.count({ where: { role: { not: "CLIENT" }, actif: true } }),
  ]);
  const shortcuts = navigationFor(user.role).filter((item) => item.href !== "/dashboard");

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Bonjour ${user.name}`}
        description={`${ROLE_LABELS[user.role]} · ${agence.nom}`}
      />
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-gt-mist bg-white p-5">
          <p className="text-sm text-gt-teal-900/70">Membres actifs de l&apos;équipe</p>
          <p className="mt-1 text-3xl font-semibold text-gt-teal-900">{equipe}</p>
        </div>
      </section>
      <section aria-labelledby="raccourcis">
        <h2 id="raccourcis" className="text-lg font-semibold text-gt-teal-900">
          Raccourcis
        </h2>
        <ul className="mt-3 flex flex-wrap gap-3">
          {shortcuts.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="inline-flex rounded-full border border-gt-teal-700 px-4 py-2 text-sm font-medium text-gt-teal-700 hover:bg-gt-cream"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
