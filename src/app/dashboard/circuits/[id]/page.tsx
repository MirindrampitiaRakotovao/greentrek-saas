import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CircuitForm } from "@/components/circuits/circuit-form";
import { CircuitItinerary } from "@/components/circuits/circuit-itinerary";
import { CircuitPartenaires } from "@/components/circuits/circuit-partenaires";
import { CircuitStatusActions } from "@/components/circuits/circuit-status-actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/dashboard/widgets";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getAgencySettings } from "@/lib/services/agency-settings";
import { getCircuit, MIN_ETAPES_PUBLICATION } from "@/lib/services/circuits";
import { DIFFICULTE_LABELS, STATUT_CIRCUIT_LABELS } from "@/lib/validators/circuits";

export const metadata: Metadata = { title: "Circuit — Green Trek" };

/** Fiche d'un circuit : statut, itinéraire sur carte, partenaires inclus, informations. */
export default async function CircuitPage({ params }: PageProps<"/dashboard/circuits/[id]">) {
  const { user, db } = await requireAgencyUser();
  const { id } = await params;
  // Client confiné : un circuit d'une autre agence donne une page 404.
  const [circuit, settings, etapes, partenaires] = await Promise.all([
    getCircuit(db, id),
    getAgencySettings(db, user.agenceId),
    db.etape.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true, type: true } }),
    db.partenaire.findMany({
      where: { actif: true },
      orderBy: { nom: "asc" },
      select: { id: true, nom: true },
    }),
  ]);
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
        description={`${STATUT_CIRCUIT_LABELS[circuit.statut]} · ${DIFFICULTE_LABELS[circuit.difficulte]} · ${circuit.dureeJours} jour(s) · ${formatMoney(circuit.prixParPersonne, settings.devise)} / pers. · ${circuit._count.sessionsDepart} départ(s)`}
      />

      {canEdit ? (
        <Card title="Publication">
          {manquantes > 0 ? (
            <p className="mb-3 text-sm text-gt-teal-900/70">
              Encore {manquantes} étape(s) à ajouter avant de pouvoir publier (RG 4 : au moins{" "}
              {MIN_ETAPES_PUBLICATION} étapes).
            </p>
          ) : (
            <p className="mb-3 text-sm text-gt-teal-900/70">
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
        />
      </Card>

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
        {canEdit ? (
          <Card title="Informations" className="min-w-0">
            <CircuitForm circuit={circuit} devise={settings.devise} agenceSlug={settings.slug} />
          </Card>
        ) : (
          <Card title="Description" className="min-w-0">
            <p className="text-sm whitespace-pre-line text-gt-teal-900/80">
              {circuit.description ?? circuit.resume ?? "—"}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
