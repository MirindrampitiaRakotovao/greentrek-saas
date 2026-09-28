import type { Metadata } from "next";

import { PlaceholderSpace } from "@/components/layout/placeholder-space";
import { getAdminDb } from "@/lib/admin-db";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Administration — Green Trek" };

/** Console super admin provisoire (E2) : la vraie console arrive en E11. */
export default async function AdminPage() {
  const user = await requireUser({ roles: ["SUPER_ADMIN"] });
  // Accès non confiné, autorisé uniquement après la vérification du rôle ci-dessus.
  const agences = await getAdminDb().agence.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, nom: true, slug: true, statut: true },
  });

  return (
    <PlaceholderSpace title="Administration de la plateforme" user={user}>
      <h2 className="mt-8 text-lg font-semibold text-gt-teal-900">Agences ({agences.length})</h2>
      <ul className="mt-3 divide-y divide-gt-mist rounded-2xl border border-gt-mist bg-white">
        {agences.map((agence) => (
          <li key={agence.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <span>
              {agence.nom} <span className="text-sm text-gt-teal-900/60">/a/{agence.slug}</span>
            </span>
            <span className="text-sm">{agence.statut === "ACTIVE" ? "Active" : "Suspendue"}</span>
          </li>
        ))}
      </ul>
    </PlaceholderSpace>
  );
}
