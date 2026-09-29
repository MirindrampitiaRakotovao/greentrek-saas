"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSuccess } from "@/components/ui/form-success";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { recordPaymentAction } from "@/lib/actions/gestion-reservations";
import { applyFieldErrors } from "@/lib/forms";
import {
  encaissementSchema,
  METHODE_PAIEMENT_LABELS,
  METHODES_PAIEMENT,
} from "@/lib/validators/reservations";

/**
 * Paiement reçu à l'agence (espèces, virement…). Montant proposé : le reste à payer ; un
 * acompte plus petit est possible, jamais plus que le reste (RG 16, vérifié par le serveur).
 */
export function EncaissementForm({
  reservationId,
  reste,
  devise,
}: {
  reservationId: string;
  reste: number;
  devise: string;
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
    resolver: zodResolver(encaissementSchema),
    defaultValues: { reservationId, montant: String(reste), methode: "ESPECES" as const },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    setSuccess(undefined);
    startTransition(async () => {
      const result = await recordPaymentAction(values);
      setServerError(result.error);
      setSuccess(result.success);
      applyFieldErrors(result.fieldErrors, setError, ["montant", "methode"] as const);
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-3">
      <FormAlert message={serverError} />
      <FormSuccess message={success} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={`Montant reçu (${devise})`}
          inputMode="numeric"
          error={errors.montant?.message}
          {...register("montant")}
        />
        <SelectField
          label="Moyen"
          options={METHODES_PAIEMENT.map((m) => ({ value: m, label: METHODE_PAIEMENT_LABELS[m] }))}
          error={errors.methode?.message}
          {...register("methode")}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer le paiement"}
      </Button>
    </form>
  );
}
