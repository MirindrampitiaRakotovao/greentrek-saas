"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSuccess } from "@/components/ui/form-success";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { TextField } from "@/components/ui/text-field";
import { createEtapeAction, updateEtapeAction } from "@/lib/actions/circuits";
import { applyFieldErrors } from "@/lib/forms";
import {
  etapeSchema,
  TYPE_ETAPE_LABELS,
  TYPES_ETAPE,
  type TypeEtape,
} from "@/lib/validators/circuits";

const TYPE_OPTIONS = TYPES_ETAPE.map((type) => ({ value: type, label: TYPE_ETAPE_LABELS[type] }));
const FIELDS = ["nom", "type", "description", "latitude", "longitude", "altitudeM"] as const;

export type EtapeFormValues = {
  id?: string;
  nom: string;
  type: TypeEtape;
  description: string | null;
  latitude: number;
  longitude: number;
  altitudeM: number | null;
};

/** Création ou modification d'une étape. Les coordonnées viennent d'un clic sur la carte. */
export function EtapeForm({
  etape,
  onDone,
}: {
  etape: EtapeFormValues;
  onDone: (message: string) => void;
}) {
  const [serverError, setServerError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(etapeSchema),
    defaultValues: {
      nom: etape.nom,
      type: etape.type,
      description: etape.description ?? "",
      latitude: etape.latitude.toFixed(6),
      longitude: etape.longitude.toFixed(6),
      altitudeM: etape.altitudeM?.toString() ?? "",
    },
  });

  // Un nouveau clic sur la carte met à jour les coordonnées du formulaire en cours.
  useEffect(() => {
    setValue("latitude", etape.latitude.toFixed(6));
    setValue("longitude", etape.longitude.toFixed(6));
  }, [etape.latitude, etape.longitude, setValue]);

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    setSuccess(undefined);
    startTransition(async () => {
      const result = etape.id
        ? await updateEtapeAction(etape.id, values)
        : await createEtapeAction(values);
      setServerError(result.error);
      applyFieldErrors(result.fieldErrors, setError, FIELDS);
      if (result.success) {
        setSuccess(result.success);
        onDone(result.success);
      }
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-3">
      <FormAlert message={serverError} />
      <FormSuccess message={success} />
      <TextField label="Nom" error={errors.nom?.message} {...register("nom")} />
      <SelectField
        label="Type"
        options={TYPE_OPTIONS}
        error={errors.type?.message}
        {...register("type")}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Latitude"
          inputMode="decimal"
          error={errors.latitude?.message}
          {...register("latitude")}
        />
        <TextField
          label="Longitude"
          inputMode="decimal"
          error={errors.longitude?.message}
          {...register("longitude")}
        />
      </div>
      <TextField
        label="Altitude en mètres (facultatif)"
        inputMode="numeric"
        error={errors.altitudeM?.message}
        {...register("altitudeM")}
      />
      <TextareaField
        label="Description (facultatif)"
        rows={3}
        error={errors.description?.message}
        {...register("description")}
      />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Enregistrement…" : etape.id ? "Enregistrer l'étape" : "Ajouter l'étape"}
      </Button>
    </form>
  );
}
