"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSuccess } from "@/components/ui/form-success";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { TextField } from "@/components/ui/text-field";
import { useCloseOnSuccess } from "@/components/ui/form-modal";
import { createPartenaireAction, updatePartenaireAction } from "@/lib/actions/backoffice";
import { applyFieldErrors } from "@/lib/forms";
import {
  partenaireSchema,
  TYPE_PARTENAIRE_LABELS,
  TYPES_PARTENAIRE,
} from "@/lib/validators/backoffice";

const TYPE_OPTIONS = TYPES_PARTENAIRE.map((type) => ({
  value: type,
  label: TYPE_PARTENAIRE_LABELS[type],
}));

const FIELDS = [
  "nom",
  "type",
  "description",
  "telephone",
  "email",
  "adresse",
  "latitude",
  "longitude",
  "tarifIndicatif",
  "imageUrl",
  "actif",
] as const;

type Partenaire = {
  id: string;
  nom: string;
  type: (typeof TYPES_PARTENAIRE)[number];
  description: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  latitude: number | null;
  longitude: number | null;
  tarifIndicatif: number | null;
  imageUrl: string | null;
  actif: boolean;
};

/** Création (sans `partenaire`) ou modification d'un partenaire. */
export function PartenaireForm({
  partenaire,
  devise,
}: {
  partenaire?: Partenaire;
  devise: string;
}) {
  const [serverError, setServerError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pending, startTransition] = useTransition();
  const closeOnSuccess = useCloseOnSuccess();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(partenaireSchema),
    defaultValues: {
      nom: partenaire?.nom ?? "",
      type: partenaire?.type ?? "HEBERGEMENT",
      description: partenaire?.description ?? "",
      telephone: partenaire?.telephone ?? "",
      email: partenaire?.email ?? "",
      adresse: partenaire?.adresse ?? "",
      latitude: partenaire?.latitude?.toString() ?? "",
      longitude: partenaire?.longitude?.toString() ?? "",
      tarifIndicatif: partenaire?.tarifIndicatif?.toString() ?? "",
      imageUrl: partenaire?.imageUrl ?? "",
      actif: partenaire?.actif ?? true,
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    setSuccess(undefined);
    startTransition(async () => {
      const result = partenaire
        ? await updatePartenaireAction(partenaire.id, values)
        : await createPartenaireAction(values); // redirige vers la liste en cas de succès
      // Dans une modale : fermeture et notification ; sinon, message sous le formulaire.
      if (closeOnSuccess(result)) return;
      setServerError(result.error);
      setSuccess(result.success);
      applyFieldErrors(result.fieldErrors, setError, FIELDS);
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={serverError} />
      <FormSuccess message={success} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Nom" error={errors.nom?.message} {...register("nom")} />
        <SelectField
          label="Type"
          options={TYPE_OPTIONS}
          error={errors.type?.message}
          {...register("type")}
        />
      </div>
      <TextareaField
        label="Description (facultatif)"
        error={errors.description?.message}
        {...register("description")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Téléphone (facultatif)"
          type="tel"
          error={errors.telephone?.message}
          {...register("telephone")}
        />
        <TextField
          label="E-mail (facultatif)"
          type="email"
          error={errors.email?.message}
          {...register("email")}
        />
      </div>
      <TextField
        label="Adresse (facultatif)"
        error={errors.adresse?.message}
        {...register("adresse")}
      />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gt-teal-900">
          Coordonnées GPS (facultatif)
        </legend>
        <p className="text-sm text-gt-teal-900/75">
          En degrés décimaux. Uniquement des relevés réels : sinon, laissez vide (la sélection sur
          carte arrive à l&apos;étape E4).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Latitude"
            inputMode="decimal"
            placeholder="-17.0"
            error={errors.latitude?.message}
            {...register("latitude")}
          />
          <TextField
            label="Longitude"
            inputMode="decimal"
            placeholder="49.5"
            error={errors.longitude?.message}
            {...register("longitude")}
          />
        </div>
      </fieldset>
      <TextField
        label={`Tarif indicatif en ${devise} (facultatif)`}
        inputMode="numeric"
        error={errors.tarifIndicatif?.message}
        {...register("tarifIndicatif")}
      />
      <TextField
        label="Photo pour le site vitrine (facultatif)"
        placeholder="https://… ou /images/partenaires/…"
        hint="Photo propre ou libre de droits (§8.1), avec attribution si nécessaire."
        error={errors.imageUrl?.message}
        {...register("imageUrl")}
      />
      <CheckboxField label="Partenaire actif" {...register("actif")} />
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : partenaire ? "Enregistrer" : "Ajouter le partenaire"}
      </Button>
    </form>
  );
}
