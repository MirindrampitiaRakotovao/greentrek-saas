import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { ToggleActiveButton } from "@/components/team/toggle-active-button";
import { Badge } from "@/components/ui/badge";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { listTeam } from "@/lib/services/team";
import { TEAM_ROLE_LABELS, type TeamRole } from "@/lib/validators/team";

export const metadata: Metadata = { title: "Équipe — Green Trek" };

const ROLE_TONES: Record<TeamRole, "teal" | "sand" | "neutral"> = {
  ADMIN_AGENCE: "teal",
  STAFF: "neutral",
  GUIDE: "sand",
};

/** Liste de l'équipe : ADMIN_AGENCE la gère, STAFF la consulte (matrice §3). */
export default async function EquipePage({ searchParams }: PageProps<"/dashboard/equipe">) {
  const { user, db } = await requireAgencyUser(["ADMIN_AGENCE", "STAFF"]);
  const page = parsePage((await searchParams).page);
  const team = await listTeam(db, page);
  const canManage = can(user.role, "modifier", "utilisateur");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Équipe"
        description={`${team.total} membre${team.total > 1 ? "s" : ""} (administrateurs, personnel, guides).`}
        actions={
          can(user.role, "creer", "utilisateur") ? (
            <Link
              href="/dashboard/equipe/nouveau"
              className="rounded-full bg-gt-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-gt-teal-800"
            >
              Ajouter un membre
            </Link>
          ) : null
        }
      />

      <div className="overflow-x-auto rounded-2xl border border-gt-mist bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Membres de l&apos;équipe</caption>
          <thead className="border-b border-gt-mist bg-gt-cream/50 text-gt-teal-900/80">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Nom
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                E-mail
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Rôle
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Statut
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Dernière connexion
              </th>
              {canManage ? (
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-gt-mist">
            {team.items.map((member) => {
              const role = member.role as TeamRole;
              const isSelf = member.id === user.id;
              return (
                <tr key={member.id} className={member.actif ? "" : "text-gt-teal-900/60"}>
                  <td className="px-4 py-3 font-medium text-gt-teal-900">
                    {member.prenom} {member.nom}
                    {isSelf ? (
                      <span className="ml-2 text-xs text-gt-teal-900/60">(vous)</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{member.email}</td>
                  <td className="px-4 py-3">
                    <Badge tone={ROLE_TONES[role]}>{TEAM_ROLE_LABELS[role]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={member.actif ? "success" : "danger"}>
                      {member.actif ? "Actif" : "Désactivé"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{formatDateTime(member.dernierLoginAt, "Jamais")}</td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-4">
                        <Link
                          href={`/dashboard/equipe/${member.id}`}
                          className="text-sm font-medium text-gt-teal-700 underline hover:text-gt-teal-900"
                        >
                          Modifier
                        </Link>
                        {isSelf ? null : (
                          <ToggleActiveButton
                            id={member.id}
                            actif={member.actif}
                            name={`${member.prenom} ${member.nom}`}
                          />
                        )}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination basePath="/dashboard/equipe" page={team.page} pageCount={team.pageCount} />
    </div>
  );
}
