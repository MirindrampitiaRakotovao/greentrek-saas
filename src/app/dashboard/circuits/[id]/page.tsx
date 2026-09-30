import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CircuitForm } from "@/components/circuits/circuit-form";
import { CircuitItinerary } from "@/components/circuits/circuit-itinerary";
import { CircuitPartenaires } from "@/components/circuits/circuit-partenaires";
import { CircuitStatusActions } from "@/components/circuits/circuit-status-actions";
import { DepartForm } from "@/components/departs/depart-form";
import { DepartList } from "@/components/departs/depart-list";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, EmptyState } from "@/components/dashboard/widgets";
import { FormModal } from "@/components/ui/form-modal";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getAgencySettings } from "@/lib/services/agency-settings";
import { getCircuit, MIN_ETAPES_PUBLICATION } from "@/lib/services/circuits";
import { departFormOptions, listCircuitDeparts } from "@/lib/services/departs";
import { latestCircuitTrace } from "@/lib/services/itineraires";
import { DIFFICULTE_LABELS, STATUT_CIRCUIT_LABELS } from "@/lib/validators/circuits";

export const metadata: Metadata = { title: "Circuit — Green Trek" };

/** Fiche d'un circuit : statut, itinéraire sur carte, partenaires inclus, informations. */
export default async function CircuitPage({ params }: PageProps<"/dashboard/circuits/[id]">) {
  const { user, db } = await requireAgencyUser();
  const { id } = await params;
  // Client confiné : un circuit d'une autre agence donne une page 404.
  const [circuit, settings, etapes, partenaires, trace, departOptions, departs] = await Promise.all(
    [
      getCircuit(db, id),
      getAgencySettings(db, user.agenceId),
      db.etape.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true, type: true } }),
      db.partenaire.findMany({
        where: { actif: true },
        orderBy: { nom: "asc" },
        select: { id: true, nom: true },
      }),
      latestCircuitTrace(db, id),
      departFormOptions(db),
      // Un GUIDE ne voit que ses propres départs : il les consulte depuis « Départs ».
      user.role === "GUIDE" ? Promise.resolve([]) : listCircuitDeparts(db, id),
    ],
  );
  if (!circuit) notFound();

  const canEdit = can(user.role, "modifier", "circuit");
  const manquantes = Math.max(0, MIN_ETAPES_PUBLICATION - circuit.etapes.length);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/circuits" className="text-sm font-medium text-gt-teal-700 underline">
        ← Retour aux circuits
      </Link>
      <PageHeader
        title={circuit.titre}
        description={`${STATUT_CIRCUIT_LABELS[circuit.statut]} · ${DIFFICULTE_LABELS[circuit.difficulte]} · ${circuit.dureeJours} jour(s) · ${formatMoney(circuit.prixParPersonne, settings.devise)} / pers. · ${circuit._count.sessionsDepart} départ(s)${trace ? ` · ${trace.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km` : ""}`}
      />

      {canEdit ? (
        <Card title="Publication">
          {manquantes > 0 ? (
            <p className="mb-3 text-sm text-gt-teal-900/75">
              Encore {manquantes} étape(s) à ajouter avant de pouvoir publier (RG 4 : au moins{" "}
              {MIN_ETAPES_PUBLICATION} étapes).
            </p>
          ) : (
            <p className="mb-3 text-sm text-gt-teal-900/75">
              Un circuit publié est visible sur le site vitrine de l&apos;agence (RG 9).
            </p>
          )}
          <CircuitStatusActions
            id={circuit.id}
            titre={circuit.titre}
            statut={circuit.statut}
            canDelete={can(user.role, "supprimer", "circuit")}
          />
        </Card>
      ) : null}

      <Card
        title={`Itinéraire (${circuit.etapes.length} étape${circuit.etapes.length > 1 ? "s" : ""})`}
      >
        <CircuitItinerary
          circuitId={circuit.id}
          steps={circuit.etapes}
          etapes={etapes}
          canEdit={canEdit}
          trace={trace}
        />
      </Card>

      {user.role === "GUIDE" ? null : (
        <Card title={`Prochains départs (${departs.length})`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gt-teal-900/75">
              {circuit.statut === "BROUILLON"
                ? "Circuit en brouillon : ses départs ne seront visibles publiquement qu'après publication."
                : "Les départs ouverts d'un circuit publié sont proposés sur le site vitrine."}
            </p>
            <div className="flex gap-2">
              <Link
                href={`/dashboard/departs?periode=tous&circuit=${circuit.id}`}
                className="rounded-full border border-gt-teal-700 px-4 py-2 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50"
              >
                Tous les départs
              </Link>
              {can(user.role, "creer", "sessionDepart") && circuit.statut !== "ARCHIVE" ? (
                <FormModal
                  triggerLabel="Programmer un départ"
                  title="Programmer un départ"
                  description={circuit.titre}
                  icon="calendar"
                >
                  <DepartForm
                    circuits={departOptions.circuits}
                    guides={departOptions.guides}
                    devise={settings.devise}
                    today={departOptions.today}
                    defaultCircuitId={circuit.id}
                  />
                </FormModal>
              ) : null}
            </div>
          </div>
          {departs.length === 0 ? (
            <EmptyState>Aucun départ à venir pour ce circuit.</EmptyState>
          ) : (
            <DepartList departs={departs} devise={settings.devise} showCircuit={false} />
          )}
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Partenaires inclus" className="min-w-0">
          <CircuitPartenaires
            circuitId={circuit.id}
            prestations={circuit.partenaires}
            partenaires={partenaires}
            etapes={circuit.etapes.map((s) => ({ id: s.etape.id, nom: s.etape.nom }))}
            devise={settings.devise}
            canEdit={canEdit}
          />
        </Card>
        <Card title="Description" className="min-w-0">
          <p className="text-sm whitespace-pre-line text-gt-teal-900/80">
            {circuit.description ?? circuit.resume ?? "—"}
          </p>
          {canEdit ? (
            <div className="mt-4">
              <FormModal
                triggerLabel="Modifier les informations"
                triggerIcon="pencil"
                variant="secondary"
                title="Modifier le circuit"
                description={circuit.titre}
                icon="mountain"
                size="lg"
              >
                <CircuitForm
                  circuit={circuit}
                  devise={settings.devise}
                  agenceSlug={settings.slug}
                />
              </FormModal>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
