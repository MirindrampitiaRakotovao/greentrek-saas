import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { MemberEditForm } from "@/components/team/member-edit-form";
import { ToggleActiveButton } from "@/components/team/toggle-active-button";
import { Badge } from "@/components/ui/badge";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { getTeamMember } from "@/lib/services/team";
import type { TeamRole } from "@/lib/validators/team";

export const metadata: Metadata = { title: "Modifier un membre — Green Trek" };

export default async function MembrePage({ params }: PageProps<"/dashboard/equipe/[id]">) {
  const { user, db } = await requireAgencyUser(["ADMIN_AGENCE"]);
  const { id } = await params;
  // Client confiné : l'identifiant d'un membre d'une autre agence donne une page 404.
  const member = await getTeamMember(db, id);
  if (!member) notFound();

  const isSelf = member.id === user.id;
  const fullName = `${member.prenom} ${member.nom}`;

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/dashboard/equipe" className="text-sm font-medium text-gt-teal-700 underline">
        ← Retour à l&apos;équipe
      </Link>
      <PageHeader title={fullName} description={member.email} />

      <dl className="grid gap-3 rounded-2xl border border-gt-mist bg-white p-6 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-gt-teal-900/70">Statut</dt>
          <dd className="mt-1">
            <Badge tone={member.actif ? "success" : "danger"}>
              {member.actif ? "Actif" : "Désactivé"}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gt-teal-900/70">Dernière connexion</dt>
          <dd className="mt-1">{formatDateTime(member.dernierLoginAt, "Jamais")}</dd>
        </div>
        <div>
          <dt className="text-sm text-gt-teal-900/70">Compte créé le</dt>
          <dd className="mt-1">{formatDateTime(member.createdAt)}</dd>
        </div>
        {isSelf ? null : (
          <div className="sm:col-span-3">
            <ToggleActiveButton id={member.id} actif={member.actif} name={fullName} />
          </div>
        )}
      </dl>

      <div className="rounded-2xl border border-gt-mist bg-white p-6">
        <MemberEditForm
          member={{
            id: member.id,
            prenom: member.prenom,
            nom: member.nom,
            telephone: member.telephone,
            role: member.role as TeamRole,
          }}
          isSelf={isSelf}
        />
      </div>
    </div>
  );
}
