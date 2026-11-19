import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/widgets";
import { Badge } from "@/components/ui/badge";
import { requireClient } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { listItinerairesClient } from "@/lib/services/itineraires-perso";

export const metadata: Metadata = { title: "Mes itinéraires" };

const km = (v: number) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
const duree = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;

/** « Mes itinéraires » : itinéraires sur mesure du voyageur (les siens uniquement). */
export default async function MesItinerairesPage({
  params,
}: PageProps<"/a/[slug]/mon-compte/itineraires">) {
  const { slug } = await params;
  const { user, db } = await requireClient(slug, `/a/${slug}/mon-compte/itineraires`);
  const itineraires = await listItinerairesClient(db, user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes itinéraires"
        description="Itinéraires sur mesure entre les villages du réseau de l'agence."
      />
      {itineraires.length === 0 ? (
        <EmptyState>Aucun itinéraire pour l&apos;instant.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {itineraires.map((it) => (
            <li key={it.id}>
              <Link
                href={`/a/${slug}/mon-compte/itineraires/${it.id}`}
                className="block rounded-3xl border border-gt-mist/70 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-lg text-gt-teal-900">{it.titre}</p>
                  <Badge
                    tone={
                      it.statut === "ACCEPTE"
                        ? "success"
                        : it.statut === "DECLINE"
                          ? "danger"
                          : "sand"
                    }
                  >
                    {it.statutLabel}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-gt-teal-900/75">
                  {it.depart} → {it.arrivee}
                </p>
                <p className="mt-2 text-sm text-gt-teal-900">
                  {km(it.distanceKm)} · {duree(it.dureeMinutes)} de marche · {it.critere}
                </p>
                <p className="mt-2 text-xs text-gt-teal-900/75">
                  {it.origine === "AGENCE" ? "Proposé par votre agence" : "Votre demande"} le{" "}
                  {formatDateTime(it.createdAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
