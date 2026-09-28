"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSuccess } from "@/components/ui/form-success";
import { TextField } from "@/components/ui/text-field";
import { changePasswordAction, updateProfileAction } from "@/lib/actions/team";
import { applyFieldErrors } from "@/lib/forms";
import { changePasswordSchema, updateProfileSchema } from "@/lib/validators/team";

/** Identité de l'utilisateur connecté. */
export function ProfileForm({
  profile,
}: {
  profile: { prenom: string; nom: string; telephone: string | null };
}) {
  const [serverError, setServerError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      prenom: profile.prenom,
      nom: profile.nom,
      telephone: profile.telephone ?? "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    setSuccess(undefined);
    startTransition(async () => {
      const result = await updateProfileAction(values);
      setServerError(result.error);
      setSuccess(result.success);
      applyFieldErrors(result.fieldErrors, setError, ["prenom", "nom", "telephone"]);
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={serverError} />
      <FormSuccess message={success} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Prénom"
          autoComplete="given-name"
          error={errors.prenom?.message}
          {...register("prenom")}
        />
        <TextField
          label="Nom"
          autoComplete="family-name"
          error={errors.nom?.message}
          {...register("nom")}
        />
      </div>
      <TextField
        label="Téléphone (facultatif)"
        type="tel"
        autoComplete="tel"
        error={errors.telephone?.message}
        {...register("telephone")}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}

/** Changement de mot de passe (l'ancien est exigé). */
export function PasswordForm() {
  const [serverError, setServerError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    setSuccess(undefined);
    startTransition(async () => {
      const result = await changePasswordAction(values);
      setServerError(result.error);
      setSuccess(result.success);
      applyFieldErrors(result.fieldErrors, setError, [
        "currentPassword",
        "newPassword",
        "confirmPassword",
      ]);
      if (result.success) reset();
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={serverError} />
      <FormSuccess message={success} />
      <TextField
        label="Mot de passe actuel"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register("currentPassword")}
      />
      <TextField
        label="Nouveau mot de passe"
        type="password"
        autoComplete="new-password"
        hint="8 caractères minimum, avec majuscule, minuscule et chiffre."
        error={errors.newPassword?.message}
        {...register("newPassword")}
      />
      <TextField
        label="Confirmation du nouveau mot de passe"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Modification…" : "Changer le mot de passe"}
      </Button>
    </form>
  );
}
