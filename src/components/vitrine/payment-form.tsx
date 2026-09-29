"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Icon, type IconName } from "@/components/ui/icon";
import { TextField } from "@/components/ui/text-field";
import { payReservationAction } from "@/lib/actions/reservations";
import { formatMoney } from "@/lib/format";
import {
  METHODE_PAIEMENT_LABELS,
  METHODES_PAIEMENT,
  NUMERO_REFUSE_SUFFIXE,
  paiementSchema,
  PAIEMENT_IMMEDIAT,
} from "@/lib/validators/reservations";

const METHODE_DETAILS: Record<
  (typeof METHODES_PAIEMENT)[number],
  { icon: IconName; text: string }
> = {
  CARTE_SIMULEE: { icon: "wallet", text: "Paiement immédiat, réservation confirmée." },
  MOBILE_MONEY: { icon: "coins", text: "Paiement immédiat, réservation confirmée." },
  VIREMENT: { icon: "building", text: "L'agence confirme à réception du virement." },
  ESPECES: { icon: "ticket", text: "Réglez à l'agence ; elle confirme à réception." },
};

/**
 * Paiement SIMULÉ (§1.4 : aucune transaction réelle). Aucun numéro n'est transmis à un
 * prestataire ; seuls les 4 derniers chiffres sont conservés comme référence. Numéro de test
 * finissant par 0000 : refus simulé (décision A de l'étape E9).
 */
export function PaymentForm({
  reservationId,
  reste,
  devise,
}: {
  reservationId: string;
  reste: number;
  devise: string;
}) {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(paiementSchema),
    defaultValues: { reservationId, methode: "MOBILE_MONEY" as const, numero: "" },
  });
  const methode = useWatch({ control, name: "methode" });
  const needsNumero = PAIEMENT_IMMEDIAT.includes(methode);

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      // Succès : redirection vers la réservation ; refus simulé : message.
      const result = await payReservationAction(values);
      setServerError(result.error);
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-5">
      <FormAlert message={serverError} />
      <fieldset>
        <legend className="text-sm font-medium text-gt-teal-900">Moyen de paiement</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {METHODES_PAIEMENT.map((m) => (
            <label
              key={m}
              className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gt-mist bg-white p-4 has-checked:border-gt-teal-600 has-checked:ring-2 has-checked:ring-gt-teal-500/30"
            >
              <input
                type="radio"
                value={m}
                className="mt-1 accent-gt-teal-700"
                {...register("methode")}
              />
              <span>
                <span className="flex items-center gap-2 font-medium text-gt-teal-900">
                  <Icon name={METHODE_DETAILS[m].icon} className="size-4 text-gt-teal-600" />
                  {METHODE_PAIEMENT_LABELS[m]}
                </span>
                <span className="mt-0.5 block text-xs text-gt-teal-900/65">
                  {METHODE_DETAILS[m].text}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {needsNumero ? (
        <TextField
          label={
            methode === "CARTE_SIMULEE"
              ? "Numéro de carte (simulé)"
              : "Numéro Mobile Money (simulé)"
          }
          inputMode="numeric"
          autoComplete="off"
          placeholder={
            methode === "CARTE_SIMULEE" ? "16 chiffres" : "10 chiffres, ex. 034 12 345 67"
          }
          hint={`Démonstration : aucun paiement réel. Un numéro finissant par ${NUMERO_REFUSE_SUFFIXE} simule un refus.`}
          error={errors.numero?.message}
          {...register("numero")}
        />
      ) : null}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Paiement…" : `Payer ${formatMoney(reste, devise)}`}
      </Button>
    </form>
  );
}
