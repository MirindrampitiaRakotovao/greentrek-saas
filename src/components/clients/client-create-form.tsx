"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { useCloseOnSuccess } from "@/components/ui/form-modal";
import { TextField } from "@/components/ui/text-field";
import { createClientAction } from "@/lib/actions/clients";
import { applyFieldErrors } from "@/lib/forms";
import { createClientSchema } from "@/lib/validators/clients";

/**
 * Ajout d'un client par l'agence : son compte voyageur est créé et il reçoit un e-mail pour
 * choisir son mot de passe (lien valable 7 jours). L'agence ne connaît jamais ce mot de passe.
 */
export function ClientCreateForm() {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const closeOnSuccess = useCloseOnSuccess();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createClientSchema),
    defaultValues: { prenom: "", nom: "", email: "", telephone: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await createClientAction(values);
      if (closeOnSuccess(result) || !result.error) return;
      setServerError(result.error);
      applyFieldErrors(result.fieldErrors, setError, ["prenom", "nom", "email", "telephone"]);
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
        hint="Le client y reçoit le lien pour choisir son mot de passe."
        error={errors.email?.message}
        {...register("email")}
      />
      <TextField
        label="Téléphone (facultatif)"
        type="tel"
        error={errors.telephone?.message}
        {...register("telephone")}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Ajout…" : "Ajouter le client"}
      </Button>
    </form>
  );
}
