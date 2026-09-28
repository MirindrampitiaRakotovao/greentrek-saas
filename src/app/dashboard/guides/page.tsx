import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { Badge } from "@/components/ui/badge";
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
  const guides = await listGuides(db, page);
  const canEdit = can(user.role, "modifier", "guide");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guides"
        description="Fiches des guides, avec ou sans compte de connexion."
        actions={
          can(user.role, "creer", "guide") ? (
            <Link
              href="/dashboard/guides/nouveau"
              className="rounded-full bg-gt-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-gt-teal-800"
            >
              Ajouter un guide
            </Link>
          ) : null
        }
      />

      {guides.total === 0 ? (
        <p className="rounded-2xl border border-dashed border-gt-mist bg-white p-8 text-center text-gt-teal-900/70">
          Aucun guide pour l&apos;instant.
        </p>
      ) : (
        <div className="relative overflow-x-auto rounded-2xl border border-gt-mist bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Guides de l&apos;agence</caption>
            <thead className="border-b border-gt-mist bg-gt-cream/50 text-gt-teal-900/80">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Nom
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Langues
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Expérience
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Compte
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Statut
                </th>
                {canEdit ? (
                  <th scope="col" className="px-4 py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-gt-mist">
              {guides.items.map((guide) => (
                <tr key={guide.id} className={guide.actif ? "" : "text-gt-teal-900/60"}>
                  <td className="px-4 py-3 font-medium text-gt-teal-900">
                    {guide.prenom} {guide.nom}
                  </td>
                  <td className="px-4 py-3">
                    {languageCodes(guide.langues).map(languageLabel).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {guide.experienceAnnees === null ? "—" : `${guide.experienceAnnees} an(s)`}
                  </td>
                  <td className="px-4 py-3">{guide.utilisateur?.email ?? "Sans compte"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={guide.actif ? "success" : "danger"}>
                      {guide.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </td>
                  {canEdit ? (
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/guides/${guide.id}`}
                        className="font-medium text-gt-teal-700 underline hover:text-gt-teal-900"
                      >
                        Modifier
                      </Link>
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
