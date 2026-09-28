"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { createMemberAction } from "@/lib/actions/team";
import { applyFieldErrors } from "@/lib/forms";
import { createMemberSchema, TEAM_ROLE_LABELS, TEAM_ROLES } from "@/lib/validators/team";

const ROLE_OPTIONS = TEAM_ROLES.map((role) => ({ value: role, label: TEAM_ROLE_LABELS[role] }));

/** Création d'un membre de l'équipe avec un mot de passe initial (aucun e-mail envoyé). */
export function MemberCreateForm() {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createMemberSchema),
    defaultValues: {
      prenom: "",
      nom: "",
      email: "",
      telephone: "",
      role: "STAFF" as const,
      password: "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      // En cas de succès, l'action redirige vers la liste de l'équipe.
      const result = await createMemberAction(values);
      if (!result.error) return;
      setServerError(result.error);
      applyFieldErrors(result.fieldErrors, setError, [
        "prenom",
        "nom",
        "email",
        "telephone",
        "role",
        "password",
      ]);
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={serverError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Prénom" error={errors.prenom?.message} {...register("prenom")} />
        <TextField label="Nom" error={errors.nom?.message} {...register("nom")} />
      </div>
      <TextField
        label="Adresse e-mail"
        type="email"
        autoComplete="off"
        hint="Sert d'identifiant de connexion sur /connexion."
        error={errors.email?.message}
        {...register("email")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Téléphone (facultatif)"
          type="tel"
          error={errors.telephone?.message}
          {...register("telephone")}
        />
        <SelectField
          label="Rôle"
          options={ROLE_OPTIONS}
          error={errors.role?.message}
          {...register("role")}
        />
      </div>
      <TextField
        label="Mot de passe initial"
        type="password"
        autoComplete="new-password"
        hint="À communiquer au membre, qui le changera dans « Mon profil ». 8 caractères minimum, avec majuscule, minuscule et chiffre."
        error={errors.password?.message}
        {...register("password")}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Création…" : "Créer le compte"}
      </Button>
    </form>
  );
}
