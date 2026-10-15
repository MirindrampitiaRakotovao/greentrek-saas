"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { FormAlert } from "@/components/ui/form-alert";
import { PasswordField } from "@/components/ui/password-field";
import { resetPasswordAction } from "@/lib/actions/mot-de-passe";
import { applyFieldErrors } from "@/lib/forms";
import { resetPasswordSchema } from "@/lib/validators/auth";

import { AUTH_SUBMIT } from "./styles";

/** Nouveau mot de passe (lien reçu par e-mail) ; succès : retour à la connexion. */
export function ResetPasswordForm({ jeton, agenceSlug }: { jeton: string; agenceSlug?: string }) {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { jeton, agenceSlug, password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await resetPasswordAction(values);
      setServerError(result.error);
      applyFieldErrors(result.fieldErrors, setError, ["password", "confirmPassword"] as const);
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-6">
      <FormAlert message={serverError} />
      <PasswordField
        appearance="encadre"
        label="Nouveau mot de passe"
        autoComplete="new-password"
        hint="8 caractères au moins, avec une majuscule, une minuscule et un chiffre."
        error={errors.password?.message}
        {...register("password")}
      />
      <PasswordField
        appearance="encadre"
        label="Confirmer le mot de passe"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <button type="submit" disabled={pending} className={AUTH_SUBMIT}>
        {pending ? "Enregistrement…" : "Enregistrer le nouveau mot de passe"}
      </button>
    </form>
  );
}
