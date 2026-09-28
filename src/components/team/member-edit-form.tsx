"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSuccess } from "@/components/ui/form-success";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { updateMemberAction } from "@/lib/actions/team";
import { applyFieldErrors } from "@/lib/forms";
import {
  type TeamRole,
  TEAM_ROLE_LABELS,
  TEAM_ROLES,
  updateMemberSchema,
} from "@/lib/validators/team";

const ROLE_OPTIONS = TEAM_ROLES.map((role) => ({ value: role, label: TEAM_ROLE_LABELS[role] }));

type Member = {
  id: string;
  prenom: string;
  nom: string;
  telephone: string | null;
  role: TeamRole;
};

/** Modification d'un membre : identité et rôle (l'e-mail, identifiant de connexion, est fixe). */
export function MemberEditForm({ member, isSelf }: { member: Member; isSelf: boolean }) {
  const [serverError, setServerError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(updateMemberSchema),
    defaultValues: {
      id: member.id,
      prenom: member.prenom,
      nom: member.nom,
      telephone: member.telephone ?? "",
      role: member.role,
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    setSuccess(undefined);
    startTransition(async () => {
      const result = await updateMemberAction(values);
      setServerError(result.error);
      setSuccess(result.success);
      applyFieldErrors(result.fieldErrors, setError, ["prenom", "nom", "telephone", "role"]);
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={serverError} />
      <FormSuccess message={success} />
      <input type="hidden" {...register("id")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Prénom" error={errors.prenom?.message} {...register("prenom")} />
        <TextField label="Nom" error={errors.nom?.message} {...register("nom")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Téléphone (facultatif)"
          type="tel"
          error={errors.telephone?.message}
          {...register("telephone")}
        />
        {isSelf ? (
          // Son propre rôle n'est pas modifiable (règle vérifiée aussi côté serveur).
          <div>
            <input type="hidden" {...register("role")} />
            <p className="text-sm font-medium text-gt-teal-900">Rôle</p>
            <p className="mt-2 text-gt-teal-900">{TEAM_ROLE_LABELS[member.role]}</p>
            <p className="mt-1 text-sm text-gt-teal-900/70">
              Vous ne pouvez pas modifier votre propre rôle.
            </p>
          </div>
        ) : (
          <SelectField
            label="Rôle"
            options={ROLE_OPTIONS}
            error={errors.role?.message}
            {...register("role")}
          />
        )}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
