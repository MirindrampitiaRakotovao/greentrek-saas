"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { useCloseOnSuccess } from "@/components/ui/form-modal";
import { StarInput } from "@/components/ui/stars";
import { TextareaField } from "@/components/ui/textarea-field";
import { createAvisAction } from "@/lib/actions/avis";
import { applyFieldErrors } from "@/lib/forms";
import { avisSchema } from "@/lib/validators/avis";

/** Avis du voyageur sur un séjour terminé (RG 17 vérifiée par le serveur). */
export function AvisForm({ reservationId }: { reservationId: string }) {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const closeOnSuccess = useCloseOnSuccess();
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(avisSchema),
    defaultValues: { reservationId, note: "", commentaire: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await createAvisAction(values);
      if (closeOnSuccess(result)) return;
      setServerError(result.error);
      applyFieldErrors(result.fieldErrors, setError, ["note", "commentaire"] as const);
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={serverError} />
      <Controller
        control={control}
        name="note"
        render={({ field }) => (
          <StarInput
            name={field.name}
            value={Number(field.value) || 0}
            onChange={(note) => field.onChange(String(note))}
            error={errors.note?.message}
          />
        )}
      />
      <TextareaField
        label="Votre commentaire (facultatif)"
        hint="Il sera publié sur le site avec votre prénom et l'initiale de votre nom, après relecture par l'agence."
        rows={5}
        maxLength={1000}
        error={errors.commentaire?.message}
        {...register("commentaire")}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Envoi…" : "Envoyer mon avis"}
      </Button>
    </form>
  );
}
