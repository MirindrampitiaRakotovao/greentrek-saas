"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Icon } from "@/components/ui/icon";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { createReservationForClientAction } from "@/lib/actions/clients";
import { agencyReservationSchema } from "@/lib/validators/clients";
import { MAX_PERSONNES_PAR_RESERVATION } from "@/lib/validators/reservations";

export type BookableDepart = {
  id: string;
  label: string;
  placesLibres: number;
  /** Prix par personne déjà formaté (« 60 000 Ar »). */
  prix: string;
};

const empty = () => ({ prenom: "", nom: "", age: "", nationalite: "", contactUrgence: "" });

/**
 * Réservation faite par l'agence pour un de ses clients : départ, voyageurs (le premier est le
 * client), remarques. Le serveur applique les règles du site (places sous verrou, montant
 * figé) ; le client est prévenu et retrouve la réservation dans son espace et l'application.
 */
export function AgencyBookingForm({
  client,
  departs,
}: {
  client: { id: string; prenom: string; nom: string };
  departs: readonly BookableDepart[];
}) {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(agencyReservationSchema),
    defaultValues: {
      clientId: client.id,
      sessionId: departs[0]?.id ?? "",
      participants: [{ ...empty(), prenom: client.prenom, nom: client.nom }],
      remarques: "",
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "participants" });
  const sessionId = useWatch({ control, name: "sessionId" });
  const depart = departs.find((d) => d.id === sessionId);
  const max = Math.min(depart?.placesLibres ?? 1, MAX_PERSONNES_PAR_RESERVATION);

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      // Succès : le serveur ouvre la fiche de la réservation (encaissement).
      const result = await createReservationForClientAction(values);
      if (!result?.error) return;
      setServerError(result.error);
      if (result.fieldErrors?.participants) {
        setError("participants", { message: result.fieldErrors.participants });
      }
    });
  });

  if (departs.length === 0) {
    return (
      <p className="text-sm text-gt-teal-900/75">
        Aucun départ ouvert avec des places libres. Programmez un départ dans « Départs ».
      </p>
    );
  }

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={serverError} />
      <input type="hidden" {...register("clientId")} />
      <SelectField
        label="Départ"
        options={departs.map((d) => ({
          value: d.id,
          label: `${d.label} · ${d.placesLibres} place${d.placesLibres > 1 ? "s" : ""} · ${d.prix} / pers.`,
        }))}
        error={errors.sessionId?.message}
        {...register("sessionId")}
      />
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-gt-teal-900">
          Voyageurs ({fields.length})
        </legend>
        {fields.map((field, i) => (
          <div key={field.id} className="rounded-xl border border-gt-mist/70 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-gt-teal-900/75">
                {i === 0 ? "Titulaire (le client)" : `Voyageur ${i + 1}`}
              </p>
              {i > 0 ? (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-xs font-medium text-red-700 underline"
                >
                  Retirer
                </button>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Prénom"
                error={errors.participants?.[i]?.prenom?.message}
                {...register(`participants.${i}.prenom`)}
              />
              <TextField
                label="Nom"
                error={errors.participants?.[i]?.nom?.message}
                {...register(`participants.${i}.nom`)}
              />
              <TextField
                label="Âge (facultatif)"
                inputMode="numeric"
                error={errors.participants?.[i]?.age?.message}
                {...register(`participants.${i}.age`)}
              />
              <TextField
                label="Nationalité (facultatif)"
                error={errors.participants?.[i]?.nationalite?.message}
                {...register(`participants.${i}.nationalite`)}
              />
            </div>
          </div>
        ))}
        {errors.participants?.message ? (
          <p className="text-sm text-red-700">{errors.participants.message}</p>
        ) : null}
        {fields.length < max ? (
          <button
            type="button"
            onClick={() => append(empty())}
            className="flex items-center gap-2 text-sm font-medium text-gt-teal-700 underline"
          >
            <Icon name="plus" className="size-4" />
            Ajouter un voyageur
          </button>
        ) : null}
      </fieldset>
      <TextareaField
        label="Remarques (facultatif)"
        rows={3}
        error={errors.remarques?.message}
        {...register("remarques")}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Réservation…" : "Réserver pour ce client"}
      </Button>
    </form>
  );
}
