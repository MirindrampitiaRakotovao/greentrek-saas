"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSuccess } from "@/components/ui/form-success";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { TextField } from "@/components/ui/text-field";
import { updateAgencySettingsAction } from "@/lib/actions/backoffice";
import { applyFieldErrors } from "@/lib/forms";
import { agencySettingsSchema, DEVISE_LABELS, DEVISES } from "@/lib/validators/backoffice";

const DEVISE_OPTIONS = DEVISES.map((devise) => ({ value: devise, label: DEVISE_LABELS[devise] }));

type Settings = {
  nom: string;
  description: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  ville: string | null;
  pays: string | null;
  devise: string;
  logoUrl: string | null;
};

const FIELDS = [
  "nom",
  "description",
  "email",
  "telephone",
  "adresse",
  "ville",
  "pays",
  "devise",
  "logoUrl",
] as const;

export function AgencySettingsForm({ settings }: { settings: Settings }) {
  const [serverError, setServerError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(agencySettingsSchema),
    defaultValues: {
      nom: settings.nom,
      description: settings.description ?? "",
      email: settings.email ?? "",
      telephone: settings.telephone ?? "",
      adresse: settings.adresse ?? "",
      ville: settings.ville ?? "",
      pays: settings.pays ?? "",
      devise: (DEVISES as readonly string[]).includes(settings.devise)
        ? (settings.devise as (typeof DEVISES)[number])
        : "MGA",
      logoUrl: settings.logoUrl ?? "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    setSuccess(undefined);
    startTransition(async () => {
      const result = await updateAgencySettingsAction(values);
      setServerError(result.error);
      setSuccess(result.success);
      applyFieldErrors(result.fieldErrors, setError, FIELDS);
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={serverError} />
      <FormSuccess message={success} />
      <TextField label="Nom de l'agence" error={errors.nom?.message} {...register("nom")} />
      <TextareaField
        label="Présentation (facultatif)"
        hint="Affichée sur le site vitrine de l'agence."
        error={errors.description?.message}
        {...register("description")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="E-mail de contact (facultatif)"
          type="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <TextField
          label="Téléphone (facultatif)"
          type="tel"
          error={errors.telephone?.message}
          {...register("telephone")}
        />
      </div>
      <TextField
        label="Adresse (facultatif)"
        error={errors.adresse?.message}
        {...register("adresse")}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Ville (facultatif)"
          error={errors.ville?.message}
          {...register("ville")}
        />
        <TextField label="Pays (facultatif)" error={errors.pays?.message} {...register("pays")} />
        <SelectField
          label="Devise"
          options={DEVISE_OPTIONS}
          error={errors.devise?.message}
          {...register("devise")}
        />
      </div>
      <TextField
        label="Adresse du logo (facultatif)"
        type="url"
        placeholder="https://…"
        hint="Adresse web d'une image (le téléversement de fichiers n'est pas prévu)."
        error={errors.logoUrl?.message}
        {...register("logoUrl")}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
