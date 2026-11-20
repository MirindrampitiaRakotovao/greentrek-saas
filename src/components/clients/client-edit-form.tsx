"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { FormAlert } from "@/components/ui/form-alert";
import { useCloseOnSuccess } from "@/components/ui/form-modal";
import { TextField } from "@/components/ui/text-field";
import { updateClientAction } from "@/lib/actions/clients";
import { applyFieldErrors } from "@/lib/forms";
import { updateClientSchema } from "@/lib/validators/clients";

type Client = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  actif: boolean;
};

/**
 * Modification d'un client par l'agence (décision E bis). L'e-mail est son identifiant de
 * connexion ; décocher « Compte actif » lui retire l'accès au site et à l'application, sans
 * toucher à ses réservations.
 */
export function ClientEditForm({ client }: { client: Client }) {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const closeOnSuccess = useCloseOnSuccess();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(updateClientSchema),
    defaultValues: { ...client, telephone: client.telephone ?? "" },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await updateClientAction(values);
      if (closeOnSuccess(result) || !result.error) return;
      setServerError(result.error);
      applyFieldErrors(result.fieldErrors, setError, ["prenom", "nom", "email", "telephone"]);
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={serverError} />
      <input type="hidden" {...register("id")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Prénom" error={errors.prenom?.message} {...register("prenom")} />
        <TextField label="Nom" error={errors.nom?.message} {...register("nom")} />
      </div>
      <TextField
        label="Adresse e-mail"
        type="email"
        autoComplete="off"
        hint="Identifiant de connexion du client sur le site et l'application."
        error={errors.email?.message}
        {...register("email")}
      />
      <TextField
        label="Téléphone (facultatif)"
        type="tel"
        error={errors.telephone?.message}
        {...register("telephone")}
      />
      <div>
        <CheckboxField label="Compte actif" {...register("actif")} />
        <p className="mt-1 text-sm text-gt-teal-900/75">
          Un compte désactivé ne peut plus se connecter ; ses réservations sont conservées.
        </p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
