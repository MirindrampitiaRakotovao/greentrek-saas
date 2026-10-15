"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { FormAlert } from "@/components/ui/form-alert";
import { FormSuccess } from "@/components/ui/form-success";
import { TextField } from "@/components/ui/text-field";
import { requestPasswordResetAction } from "@/lib/actions/mot-de-passe";
import { forgotPasswordSchema } from "@/lib/validators/auth";

import { AUTH_SUBMIT } from "./styles";

/**
 * Demande d'un lien de réinitialisation. Le message de confirmation est le même que
 * l'adresse corresponde à un compte ou non (on ne révèle pas quels comptes existent).
 */
export function ForgotPasswordForm({ agenceSlug }: { agenceSlug?: string }) {
  const [serverError, setServerError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "", agenceSlug },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await requestPasswordResetAction(values);
      setServerError(result.error);
      setSuccess(result.success);
    });
  });

  if (success) return <FormSuccess message={success} />;

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-6">
      <FormAlert message={serverError} />
      <TextField
        appearance="encadre"
        label="Adresse e-mail du compte"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <button type="submit" disabled={pending} className={AUTH_SUBMIT}>
        {pending ? "Envoi…" : "Recevoir le lien par e-mail"}
      </button>
    </form>
  );
}
