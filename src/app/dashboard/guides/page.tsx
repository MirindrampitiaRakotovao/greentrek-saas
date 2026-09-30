import type { Metadata } from "next";

import { GuideForm } from "@/components/backoffice/guide-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/ui/delete-button";
import { FormModal } from "@/components/ui/form-modal";
import { deleteGuideAction } from "@/lib/actions/backoffice";
import { requireAgencyUser } from "@/lib/auth/session";
import { parsePage } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { languageCodes, listGuides } from "@/lib/services/guides";
import { LANGUE_LABELS } from "@/lib/validators/backoffice";

export const metadata: Metadata = { title: "Guides — Green Trek" };

function languageLabel(code: string): string {
  return code in LANGUE_LABELS ? LANGUE_LABELS[code as keyof typeof LANGUE_LABELS] : code;
}

/** Fiches des guides : ADMIN_AGENCE les gère, STAFF les consulte. */
export default async function GuidesPage({ searchParams }: PageProps<"/dashboard/guides">) {
  const { user, db } = await requireAgencyUser(["ADMIN_AGENCE", "STAFF"]);
  const page = parsePage((await searchParams).page);
  const canEdit = can(user.role, "modifier", "guide");
  const [guides, guideAccounts] = await Promise.all([
    listGuides(db, page),
    // Comptes GUIDE de l'agence : ceux sans fiche sont proposés à la liaison (formulaires).
    db.utilisateur.findMany({
      where: { role: "GUIDE" },
      select: { id: true, prenom: true, nom: true, email: true, guide: { select: { id: true } } },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    }),
  ]);
  /** Comptes proposés pour une fiche : ceux sans fiche, plus celui déjà relié à celle-ci. */
  const accountsFor = (utilisateurId: string | null) =>
    guideAccounts
      .filter((a) => a.guide === null || a.id === utilisateurId)
      .map(({ id, prenom, nom, email }) => ({ id, prenom, nom, email }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guides"
        description="Fiches des guides, avec ou sans compte de connexion."
        actions={
          can(user.role, "creer", "guide") ? (
            <FormModal
              triggerLabel="Ajouter un guide"
              title="Ajouter un guide"
              description="Fiche du guide, reliée ou non à un compte de connexion."
              icon="compass"
            >
              <GuideForm accounts={accountsFor(null)} />
            </FormModal>
          ) : null
        }
      />

      {guides.total === 0 ? (
        <p className="rounded-2xl border border-dashed border-gt-mist bg-white p-8 text-center text-gt-teal-900/75">
          Aucun guide pour l&apos;instant.
        </p>
      ) : (
        <div className="gt-table-wrap">
          <table className="gt-table min-w-[640px]">
            <caption className="sr-only">Guides de l&apos;agence</caption>
            <thead>
              <tr>
                <th scope="col">Nom</th>
                <th scope="col">Langues</th>
                <th scope="col">Expérience</th>
                <th scope="col">Compte</th>
                <th scope="col">Statut</th>
                {canEdit ? (
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {guides.items.map((guide) => (
                <tr key={guide.id} className={guide.actif ? "" : "text-gt-teal-900/75"}>
                  <td className="font-medium text-gt-teal-900">
                    {guide.prenom} {guide.nom}
                  </td>
                  <td>{languageCodes(guide.langues).map(languageLabel).join(", ") || "—"}</td>
                  <td>
                    {guide.experienceAnnees === null ? "—" : `${guide.experienceAnnees} an(s)`}
                  </td>
                  <td>{guide.utilisateur?.email ?? "Sans compte"}</td>
                  <td>
                    <Badge tone={guide.actif ? "success" : "danger"}>
                      {guide.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </td>
                  {canEdit ? (
                    <td className="text-right">
                      <FormModal
                        triggerLabel="Modifier"
                        triggerIcon="pencil"
                        variant="ghost"
                        title={`${guide.prenom} ${guide.nom}`}
                        description={`Encadre ${guide._count.sessionsDepart} départ(s).`}
                        icon="compass"
                      >
                        <GuideForm
                          guide={{ ...guide, langues: languageCodes(guide.langues) }}
                          accounts={accountsFor(guide.utilisateurId)}
                        />
                        <div className="mt-6 border-t border-gt-mist/70 pt-5">
                          <p className="mb-3 text-sm text-gt-teal-900/75">
                            Suppression possible uniquement si la fiche n&apos;encadre aucun départ
                            et n&apos;est reliée à aucun compte. Sinon, décochez « Guide actif ».
                          </p>
                          <DeleteButton
                            id={guide.id}
                            label="Supprimer la fiche"
                            confirmMessage={`La fiche de ${guide.prenom} ${guide.nom} sera supprimée définitivement.`}
                            action={deleteGuideAction}
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

      <Pagination basePath="/dashboard/guides" page={guides.page} pageCount={guides.pageCount} />
    </div>
  );
}
