"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { DeleteButton } from "@/components/ui/delete-button";
import { FormAlert } from "@/components/ui/form-alert";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { TextField } from "@/components/ui/text-field";
import {
  createTronconAction,
  deleteTronconAction,
  updateTronconAction,
} from "@/lib/actions/circuits";
import { applyFieldErrors } from "@/lib/forms";
import { COEFFICIENT_SINUOSITE, VITESSE_MARCHE_KMH } from "@/lib/graph/config";
import { estimateDistanceKm, estimateDurationMinutes } from "@/lib/graph/estimation";
import { haversineKm } from "@/lib/graph/haversine";
import { DIFFICULTE_TRONCON_LABELS, tronconSchema } from "@/lib/validators/circuits";

export type TronconValues = {
  id?: string;
  etapeDepartId: string;
  etapeArriveeId: string;
  distanceKm: number;
  dureeMinutes: number;
  deniveleM: number | null;
  difficulte: number;
  bidirectionnel: boolean;
  distanceEstimee: boolean;
  commentaire: string | null;
};

type EtapeOption = { id: string; nom: string; latitude: number; longitude: number };

const FIELDS = [
  "etapeDepartId",
  "etapeArriveeId",
  "distanceKm",
  "dureeMinutes",
  "deniveleM",
  "difficulte",
  "bidirectionnel",
  "distanceEstimee",
  "commentaire",
] as const;

const DIFFICULTE_OPTIONS = [1, 2, 3, 4, 5].map((d) => ({
  value: String(d),
  label: DIFFICULTE_TRONCON_LABELS[d]!,
}));

/** Valeurs proposées pour un nouveau tronçon entre deux étapes (estimations §6.1). */
export function suggestedTroncon(depart: EtapeOption, arrivee: EtapeOption): TronconValues {
  const distanceKm = estimateDistanceKm(depart, arrivee);
  return {
    etapeDepartId: depart.id,
    etapeArriveeId: arrivee.id,
    distanceKm,
    dureeMinutes: estimateDurationMinutes(distanceKm),
    deniveleM: null,
    difficulte: 2,
    bidirectionnel: true,
    distanceEstimee: true,
    commentaire: null,
  };
}

/**
 * Création ou modification d'un tronçon. La distance et la durée sont PROPOSÉES par les
 * estimations (Haversine × sinuosité, Naismith adaptée) ; saisir une distance mesurée
 * décoche automatiquement « distance estimée ».
 */
export function TronconForm({
  troncon,
  etapes,
  canDelete,
  onDone,
}: {
  troncon: TronconValues;
  etapes: readonly EtapeOption[];
  canDelete: boolean;
  onDone: () => void;
}) {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(tronconSchema),
    defaultValues: {
      etapeDepartId: troncon.etapeDepartId,
      etapeArriveeId: troncon.etapeArriveeId,
      distanceKm: String(troncon.distanceKm),
      dureeMinutes: String(troncon.dureeMinutes),
      deniveleM: troncon.deniveleM?.toString() ?? "",
      difficulte: String(troncon.difficulte),
      bidirectionnel: troncon.bidirectionnel,
      distanceEstimee: troncon.distanceEstimee,
      commentaire: troncon.commentaire ?? "",
    },
  });

  const [departId, arriveeId, distance, denivele] = useWatch({
    control,
    name: ["etapeDepartId", "etapeArriveeId", "distanceKm", "deniveleM"],
  });
  const depart = etapes.find((e) => e.id === departId);
  const arrivee = etapes.find((e) => e.id === arriveeId);
  const volOiseau = depart && arrivee ? haversineKm(depart, arrivee) : null;
  const etapeOptions = etapes.map((e) => ({ value: e.id, label: e.nom }));

  function proposeDistance() {
    if (!depart || !arrivee) return;
    setValue("distanceKm", String(estimateDistanceKm(depart, arrivee)));
    setValue("distanceEstimee", true);
  }

  function proposeDuration() {
    const km = Number(String(distance).replace(",", "."));
    const dPlus = denivele === "" || denivele === null ? null : Number(denivele);
    if (Number.isFinite(km) && km > 0) {
      setValue(
        "dureeMinutes",
        String(estimateDurationMinutes(km, Number.isFinite(dPlus) ? dPlus : null)),
      );
    }
  }

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = troncon.id
        ? await updateTronconAction(troncon.id, values)
        : await createTronconAction(values);
      setServerError(result.error);
      applyFieldErrors(result.fieldErrors, setError, FIELDS);
      if (result.success) onDone();
    });
  });

  const small =
    "text-xs font-medium text-gt-teal-700 underline hover:text-gt-teal-900 disabled:opacity-40";

  return (
    <div className="space-y-4">
      <form method="post" onSubmit={onSubmit} noValidate className="space-y-3">
        <FormAlert message={serverError} />
        <SelectField
          label="Départ"
          options={etapeOptions}
          error={errors.etapeDepartId?.message}
          {...register("etapeDepartId")}
        />
        <SelectField
          label="Arrivée"
          options={etapeOptions}
          error={errors.etapeArriveeId?.message}
          {...register("etapeArriveeId")}
        />
        {volOiseau !== null ? (
          <p className="rounded-lg bg-gt-teal-50 px-3 py-2 text-xs text-gt-teal-900/75">
            À vol d&apos;oiseau :{" "}
            <strong>{volOiseau.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} km</strong> ·
            estimation = × {COEFFICIENT_SINUOSITE.toLocaleString("fr-FR")} (sinuosité)
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <TextField
              label="Distance (km)"
              inputMode="decimal"
              error={errors.distanceKm?.message}
              {...register("distanceKm", {
                // Une distance saisie à la main est une mesure : plus une estimation.
                onChange: () => setValue("distanceEstimee", false),
              })}
            />
            <button
              type="button"
              onClick={proposeDistance}
              className={small}
              disabled={!depart || !arrivee}
            >
              Proposer
            </button>
          </div>
          <div>
            <TextField
              label="Durée (min)"
              inputMode="numeric"
              error={errors.dureeMinutes?.message}
              {...register("dureeMinutes")}
            />
            <button type="button" onClick={proposeDuration} className={small}>
              Proposer ({VITESSE_MARCHE_KMH} km/h)
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Dénivelé (m, facultatif)"
            inputMode="numeric"
            hint="Positif à la montée."
            error={errors.deniveleM?.message}
            {...register("deniveleM")}
          />
          <SelectField
            label="Difficulté"
            options={DIFFICULTE_OPTIONS}
            error={errors.difficulte?.message}
            {...register("difficulte")}
          />
        </div>
        <CheckboxField label="Praticable dans les deux sens" {...register("bidirectionnel")} />
        <CheckboxField
          label="Distance estimée (pas encore de mesure de terrain)"
          {...register("distanceEstimee")}
        />
        <TextareaField
          label="Commentaire (facultatif)"
          rows={2}
          error={errors.commentaire?.message}
          {...register("commentaire")}
        />
        <Button type="submit" disabled={pending} className="w-full">
          {pending
            ? "Enregistrement…"
            : troncon.id
              ? "Enregistrer le tronçon"
              : "Ajouter le tronçon"}
        </Button>
      </form>
      {troncon.id && canDelete ? (
        <div className="border-t border-gt-mist/60 pt-4">
          <DeleteButton
            id={troncon.id}
            label="Supprimer le tronçon"
            confirmMessage="Supprimer ce tronçon ?"
            action={async (input) => {
              const result = await deleteTronconAction(input);
              if (!result.error) onDone();
              return result;
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
