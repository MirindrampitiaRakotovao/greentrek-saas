import type { Metadata } from "next";

import { PartenaireForm } from "@/components/backoffice/partenaire-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/ui/delete-button";
import { FormModal } from "@/components/ui/form-modal";
import { deletePartenaireAction } from "@/lib/actions/backoffice";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { getAgencySettings } from "@/lib/services/agency-settings";
import { listPartenaires } from "@/lib/services/partenaires";
import { TYPE_PARTENAIRE_LABELS } from "@/lib/validators/backoffice";

export const metadata: Metadata = { title: "Partenaires — Green Trek" };

/** Partenaires : ADMIN_AGENCE les gère, STAFF les consulte. */
export default async function PartenairesPage({
  searchParams,
}: PageProps<"/dashboard/partenaires">) {
  const { user, db } = await requireAgencyUser(["ADMIN_AGENCE", "STAFF"]);
  const page = parsePage((await searchParams).page);
  const [partenaires, { devise }] = await Promise.all([
    listPartenaires(db, page),
    getAgencySettings(db, user.agenceId),
  ]);
  const canEdit = can(user.role, "modifier", "partenaire");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partenaires"
        description="Hébergements, restaurants, activités et transports associés à vos circuits."
        actions={
          can(user.role, "creer", "partenaire") ? (
            <FormModal
              triggerLabel="Ajouter un partenaire"
              title="Ajouter un partenaire"
              description="Hébergement, restauration, activité ou transport."
              icon="handshake"
            >
              <PartenaireForm devise={devise} />
            </FormModal>
          ) : null
        }
      />

      {partenaires.total === 0 ? (
        <p className="rounded-2xl border border-dashed border-gt-mist bg-white p-8 text-center text-gt-teal-900/70">
          Aucun partenaire pour l&apos;instant.
        </p>
      ) : (
        <div className="gt-table-wrap">
          <table className="gt-table min-w-[640px]">
            <caption className="sr-only">Partenaires de l&apos;agence</caption>
            <thead>
              <tr>
                <th scope="col">Nom</th>
                <th scope="col">Type</th>
                <th scope="col">Téléphone</th>
                <th scope="col">Tarif indicatif</th>
                <th scope="col">Circuits</th>
                <th scope="col">Statut</th>
                {canEdit ? (
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {partenaires.items.map((partenaire) => (
                <tr key={partenaire.id} className={partenaire.actif ? "" : "text-gt-teal-900/60"}>
                  <td className="font-medium text-gt-teal-900">{partenaire.nom}</td>
                  <td>{TYPE_PARTENAIRE_LABELS[partenaire.type]}</td>
                  <td>{partenaire.telephone ?? "—"}</td>
                  <td>{formatMoney(partenaire.tarifIndicatif, devise)}</td>
                  <td>{partenaire._count.circuits}</td>
                  <td>
                    <Badge tone={partenaire.actif ? "success" : "danger"}>
                      {partenaire.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </td>
                  {canEdit ? (
                    <td className="text-right">
                      <FormModal
                        triggerLabel="Modifier"
                        triggerIcon="pencil"
                        variant="ghost"
                        title={partenaire.nom}
                        description={`Inclus dans ${partenaire._count.circuits} circuit(s).`}
                        icon="handshake"
                      >
                        <PartenaireForm partenaire={partenaire} devise={devise} />
                        <div className="mt-6 border-t border-gt-mist/70 pt-5">
                          <p className="mb-3 text-sm text-gt-teal-900/70">
                            Suppression possible uniquement si le partenaire n&apos;est inclus dans
                            aucun circuit. Sinon, décochez « Partenaire actif ».
                          </p>
                          <DeleteButton
                            id={partenaire.id}
                            label="Supprimer le partenaire"
                            confirmMessage={`« ${partenaire.nom} » sera supprimé définitivement.`}
                            action={deletePartenaireAction}
                          />
                        </div>
                      </FormModal>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath="/dashboard/partenaires"
        page={partenaires.page}
        pageCount={partenaires.pageCount}
      />
    </div>
  );
}
