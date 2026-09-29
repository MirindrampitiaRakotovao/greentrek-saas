"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSuccess } from "@/components/ui/form-success";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { TextField } from "@/components/ui/text-field";
import { useCloseOnSuccess } from "@/components/ui/form-modal";
import { createDepartAction, updateDepartAction } from "@/lib/actions/departs";
import { defaultDateFin, parseIsoDate, toIsoDate } from "@/lib/departs";
import { applyFieldErrors } from "@/lib/forms";
import { formatMoney } from "@/lib/format";
import { departSchema } from "@/lib/validators/departs";

const FIELDS = [
  "circuitId",
  "dateDebut",
  "dateFin",
  "placesTotal",
  "prixParPersonne",
  "guideId",
  "notes",
] as const;

export type CircuitOption = {
  id: string;
  titre: string;
  dureeJours: number;
  capaciteMax: number;
  prixParPersonne: number;
};

type Depart = {
  id: string;
  circuitId: string;
  dateDebut: Date;
  dateFin: Date;
  placesTotal: number;
  prixParPersonne: number | null;
  guideId: string | null;
  notes: string | null;
  reservees: number;
};

/**
 * Programmation (sans `depart`) ou modification d'un départ. À la création, choisir le
 * circuit reprend sa capacité, et la date de fin est proposée d'après sa durée (RG 10) tant
 * qu'elle n'a pas été modifiée à la main.
 */
export function DepartForm({
  circuits,
  guides,
  devise,
  today,
  depart,
  defaultCircuitId,
}: {
  circuits: readonly CircuitOption[];
  guides: readonly { id: string; label: string }[];
  devise: string;
  /** « AAAA-MM-JJ » du jour (Madagascar), borne minimale des dates. */
  today: string;
  depart?: Depart;
  defaultCircuitId?: string;
}) {
  const [serverError, setServerError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [finEdited, setFinEdited] = useState(Boolean(depart));
  const [pending, startTransition] = useTransition();
  const closeOnSuccess = useCloseOnSuccess();
  const initialCircuit = circuits.find((c) => c.id === defaultCircuitId) ?? circuits[0];
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm({
    // En modification, le circuit (non modifiable) est ignoré par le schéma du serveur.
    resolver: zodResolver(departSchema),
    defaultValues: {
      circuitId: depart?.circuitId ?? initialCircuit?.id ?? "",
      dateDebut: depart ? toIsoDate(depart.dateDebut) : "",
      dateFin: depart ? toIsoDate(depart.dateFin) : "",
      placesTotal: String(depart?.placesTotal ?? initialCircuit?.capaciteMax ?? ""),
      prixParPersonne: depart?.prixParPersonne?.toString() ?? "",
      guideId: depart?.guideId ?? "",
      notes: depart?.notes ?? "",
    },
  });
  const circuitId = useWatch({ control, name: "circuitId" });
  const circuit = depart ? undefined : circuits.find((c) => c.id === circuitId);

  function proposeFin(dateDebut: string, dureeJours: number | undefined) {
    if (finEdited || !dureeJours || !/^\d{4}-\d{2}-\d{2}$/.test(dateDebut)) return;
    setValue("dateFin", toIsoDate(defaultDateFin(parseIsoDate(dateDebut), dureeJours)));
  }

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    setSuccess(undefined);
    startTransition(async () => {
      const result = depart
        ? await updateDepartAction(depart.id, values)
        : await createDepartAction(values); // redirige vers le départ créé
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
      {depart ? null : (
        <SelectField
          label="Circuit"
          options={circuits.map((c) => ({ value: c.id, label: c.titre }))}
          error={errors.circuitId?.message}
          {...register("circuitId", {
            onChange: (event: { target: { value: string } }) => {
              const next = circuits.find((c) => c.id === event.target.value);
              if (!next) return;
              setValue("placesTotal", String(next.capaciteMax));
              proposeFin(getValues("dateDebut"), next.dureeJours);
            },
          })}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Date de début"
          type="date"
          min={depart ? undefined : today}
          error={errors.dateDebut?.message}
          {...register("dateDebut", {
            onChange: (event: { target: { value: string } }) =>
              proposeFin(event.target.value, circuit?.dureeJours),
          })}
        />
        <TextField
          label="Date de fin"
          type="date"
          hint={
            circuit
              ? `Proposée d'après la durée du circuit (${circuit.dureeJours} jour${circuit.dureeJours > 1 ? "s" : ""}).`
              : undefined
          }
          error={errors.dateFin?.message}
          {...register("dateFin", { onChange: () => setFinEdited(true) })}
        />
        <TextField
          label="Nombre de places"
          inputMode="numeric"
          hint={
            depart
              ? `${depart.reservees} place(s) déjà réservée(s) : minimum.`
              : circuit
                ? `Au plus ${circuit.capaciteMax} (capacité du circuit).`
                : undefined
          }
          error={errors.placesTotal?.message}
          {...register("placesTotal")}
        />
        <TextField
          label={`Prix par personne (${devise}, facultatif)`}
          inputMode="numeric"
          hint={
            circuit
              ? `Vide : prix du circuit, ${formatMoney(circuit.prixParPersonne, devise)}.`
              : "Vide : prix du circuit."
          }
          error={errors.prixParPersonne?.message}
          {...register("prixParPersonne")}
        />
      </div>
      <SelectField
        label="Guide (facultatif)"
        options={[
          { value: "", label: "— Aucun guide pour l'instant —" },
          ...guides.map((g) => ({ value: g.id, label: g.label })),
        ]}
        error={errors.guideId?.message}
        {...register("guideId")}
      />
      <TextareaField
        label="Notes internes (facultatif)"
        rows={3}
        error={errors.notes?.message}
        {...register("notes")}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : depart ? "Enregistrer" : "Programmer le départ"}
      </Button>
    </form>
  );
}
