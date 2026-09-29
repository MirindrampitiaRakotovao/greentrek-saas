import type { Metadata } from "next";
import Link from "next/link";

import { CircuitForm } from "@/components/circuits/circuit-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/dashboard/widgets";
import { requireAgencyUser } from "@/lib/auth/session";
import { getAgencySettings } from "@/lib/services/agency-settings";

export const metadata: Metadata = { title: "Nouveau circuit — Green Trek" };

export default async function NouveauCircuitPage() {
  // Création : ADMIN_AGENCE et STAFF (matrice §3).
  const { user, db } = await requireAgencyUser(["ADMIN_AGENCE", "STAFF"]);
  const { devise, slug } = await getAgencySettings(db, user.agenceId);

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/dashboard/circuits" className="text-sm font-medium text-gt-teal-700 underline">
        ← Retour aux circuits
      </Link>
      <PageHeader
        title="Nouveau circuit"
        description="Le circuit est créé en brouillon ; vous ajouterez ensuite ses étapes."
      />
      <Card>
        <CircuitForm devise={devise} agenceSlug={slug} />
      </Card>
    </div>
  );
}
