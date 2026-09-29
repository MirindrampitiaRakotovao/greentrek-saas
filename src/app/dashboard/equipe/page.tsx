import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { MemberCreateForm } from "@/components/team/member-create-form";
import { MemberEditForm } from "@/components/team/member-edit-form";
import { ToggleActiveButton } from "@/components/team/toggle-active-button";
import { Badge } from "@/components/ui/badge";
import { FormModal } from "@/components/ui/form-modal";
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
            <FormModal
              triggerLabel="Ajouter un membre"
              title="Ajouter un membre"
              description="Administrateur, personnel ou guide : vous choisissez son mot de passe initial."
              icon="users"
            >
              <MemberCreateForm />
            </FormModal>
          ) : null
        }
      />

      <div className="gt-table-wrap">
        <table className="gt-table min-w-[640px]">
          <caption className="sr-only">Membres de l&apos;équipe</caption>
          <thead>
            <tr>
              <th scope="col">Nom</th>
              <th scope="col">E-mail</th>
              <th scope="col">Rôle</th>
              <th scope="col">Statut</th>
              <th scope="col">Dernière connexion</th>
              {canManage ? (
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {team.items.map((member) => {
              const role = member.role as TeamRole;
              const isSelf = member.id === user.id;
              return (
                <tr key={member.id} className={member.actif ? "" : "text-gt-teal-900/60"}>
                  <td className="font-medium text-gt-teal-900">
                    {member.prenom} {member.nom}
                    {isSelf ? (
                      <span className="ml-2 text-xs text-gt-teal-900/60">(vous)</span>
                    ) : null}
                  </td>
                  <td>{member.email}</td>
                  <td>
                    <Badge tone={ROLE_TONES[role]}>{TEAM_ROLE_LABELS[role]}</Badge>
                  </td>
                  <td>
                    <Badge tone={member.actif ? "success" : "danger"}>
                      {member.actif ? "Actif" : "Désactivé"}
                    </Badge>
                  </td>
                  <td>{formatDateTime(member.dernierLoginAt, "Jamais")}</td>
                  {canManage ? (
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <FormModal
                          triggerLabel="Modifier"
                          triggerIcon="pencil"
                          variant="ghost"
                          title={`${member.prenom} ${member.nom}`}
                          description={`${member.email} · dernière connexion : ${formatDateTime(member.dernierLoginAt, "jamais")}`}
                          icon="user"
                        >
                          <MemberEditForm
                            member={{
                              id: member.id,
                              prenom: member.prenom,
                              nom: member.nom,
                              telephone: member.telephone,
                              role,
                            }}
                            isSelf={isSelf}
                          />
                        </FormModal>
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
