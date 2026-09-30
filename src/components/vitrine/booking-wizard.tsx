"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { TextField } from "@/components/ui/text-field";
import { BookingStepper } from "@/components/vitrine/booking-stepper";
import { createReservationAction } from "@/lib/actions/reservations";
import { formatMoney } from "@/lib/format";
import { MAX_PERSONNES_PAR_RESERVATION, reservationSchema } from "@/lib/validators/reservations";

type ParticipantDraft = {
  prenom: string;
  nom: string;
  age: string;
  nationalite: string;
  contactUrgence: string;
};

const emptyParticipant = (): ParticipantDraft => ({
  prenom: "",
  nom: "",
  age: "",
  nationalite: "",
  contactUrgence: "",
});

/**
 * Tunnel de réservation (§7.2) : nombre de voyageurs → participants → récapitulatif. La
 * validation Zod s'exécute à chaque étape (retour immédiat), puis de nouveau sur le serveur,
 * qui calcule le montant (RG 14) et vérifie les places sous verrou (RG 13) : le total affiché
 * ici n'est qu'indicatif. Succès : redirection vers le paiement simulé.
 */
export function BookingWizard({
  sessionId,
  placesLibres,
  prix,
  devise,
  client,
}: {
  sessionId: string;
  placesLibres: number;
  prix: number;
  devise: string;
  /** Pré-remplit le premier participant avec le titulaire du compte. */
  client: { prenom: string; nom: string };
}) {
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const max = Math.min(placesLibres, MAX_PERSONNES_PAR_RESERVATION);

  const {
    register,
    control,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      sessionId,
      participants: [{ ...emptyParticipant(), prenom: client.prenom, nom: client.nom }],
      remarques: "",
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "participants" });
  const participants = useWatch({ control, name: "participants" });

  function setNombre(value: number) {
    const target = Math.max(1, Math.min(max, value));
    if (target > fields.length) {
      append(Array.from({ length: target - fields.length }, emptyParticipant));
    } else if (target < fields.length) {
      remove(Array.from({ length: fields.length - target }, (_, i) => target + i));
    }
  }

  async function next() {
    if (step === 1 && !(await trigger("participants"))) return;
    setStep((s) => s + 1);
    window.scrollTo({ top: 0 });
  }

  const submit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await createReservationAction(values);
      // Refus (places prises entre-temps, départ fermé…) : message du serveur.
      if (result.error) {
        setServerError(
          result.fieldErrors?.participants
            ? `${result.error} Modifiez le nombre de voyageurs.`
            : result.error,
        );
        if (result.fieldErrors?.participants) setStep(0);
      }
    });
  });

  // Envoi avant la dernière étape (touche Entrée dans un champ) : étape suivante, jamais la
  // réservation. Seul le bouton « Confirmer la réservation » crée la réservation.
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (step < 2) {
      event.preventDefault();
      void next();
      return;
    }
    void submit(event);
  }

  const total = prix * fields.length;
  const nombreOptions = Array.from({ length: max }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1} voyageur${i > 0 ? "s" : ""}`,
  }));

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-6">
      <BookingStepper current={step} />
      <FormAlert message={serverError} />

      {step === 0 ? (
        <section aria-labelledby="etape-voyageurs" className="space-y-4">
          <h2 id="etape-voyageurs" className="text-xl font-medium text-gt-teal-900">
            Combien de voyageurs ?
          </h2>
          <SelectField
            label="Nombre de voyageurs"
            name="nombre"
            options={nombreOptions}
            value={String(fields.length)}
            onChange={(event) => setNombre(Number(event.target.value))}
          />
          <p className="text-sm text-gt-teal-900/75">
            {placesLibres} place{placesLibres > 1 ? "s" : ""} libre{placesLibres > 1 ? "s" : ""} sur
            ce départ · {formatMoney(prix, devise)} par personne.
          </p>
        </section>
      ) : null}

      {step === 1 ? (
        <section aria-labelledby="etape-participants" className="space-y-5">
          <h2 id="etape-participants" className="text-xl font-medium text-gt-teal-900">
            Qui part ?
          </h2>
          <p className="text-sm text-gt-teal-900/75">
            Un participant par voyageur : le guide dispose ainsi de la liste du groupe. Seuls le
            prénom et le nom sont obligatoires.
          </p>
          {fields.map((field, index) => {
            const e = errors.participants?.[index];
            return (
              <fieldset
                key={field.id}
                className="rounded-2xl border border-gt-mist/80 bg-white p-4 sm:p-5"
              >
                <legend className="px-1 text-sm font-semibold text-gt-teal-800">
                  Voyageur {index + 1}
                  {index === 0 ? " (vous)" : ""}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    label="Prénom"
                    id={`participants-${index}-prenom`}
                    error={e?.prenom?.message}
                    {...register(`participants.${index}.prenom`)}
                  />
                  <TextField
                    label="Nom"
                    id={`participants-${index}-nom`}
                    error={e?.nom?.message}
                    {...register(`participants.${index}.nom`)}
                  />
                  <TextField
                    label="Âge (facultatif)"
                    id={`participants-${index}-age`}
                    inputMode="numeric"
                    error={e?.age?.message}
                    {...register(`participants.${index}.age`)}
                  />
                  <TextField
                    label="Nationalité (facultatif)"
                    id={`participants-${index}-nationalite`}
                    error={e?.nationalite?.message}
                    {...register(`participants.${index}.nationalite`)}
                  />
                  <TextField
                    label="Contact d'urgence (facultatif)"
                    id={`participants-${index}-contact`}
                    placeholder="Nom et téléphone"
                    className="sm:col-span-2"
                    error={e?.contactUrgence?.message}
                    {...register(`participants.${index}.contactUrgence`)}
                  />
                </div>
              </fieldset>
            );
          })}
        </section>
      ) : null}

      {step === 2 ? (
        <section aria-labelledby="etape-recap" className="space-y-4">
          <h2 id="etape-recap" className="text-xl font-medium text-gt-teal-900">
            Récapitulatif
          </h2>
          <ul className="divide-y divide-gt-mist/70 rounded-2xl border border-gt-mist/80 bg-white px-4">
            {(participants ?? getValues("participants")).map((p, index) => (
              <li key={fields[index]?.id ?? index} className="py-2.5 text-sm text-gt-teal-900">
                <span className="font-medium">
                  {p.prenom} {p.nom}
                </span>
                {p.age ? <span className="text-gt-teal-900/75"> · {String(p.age)} ans</span> : null}
              </li>
            ))}
          </ul>
          <dl className="flex items-baseline justify-between rounded-2xl bg-gt-teal-50 px-4 py-3">
            <dt className="text-sm text-gt-teal-900/75">
              {fields.length} × {formatMoney(prix, devise)}
            </dt>
            <dd className="text-xl font-bold text-gt-teal-900">{formatMoney(total, devise)}</dd>
          </dl>
          <TextareaField
            label="Remarques pour l'agence (facultatif)"
            rows={3}
            placeholder="Régime alimentaire, besoins particuliers…"
            error={errors.remarques?.message}
            {...register("remarques")}
          />
          <p className="text-xs text-gt-teal-900/75">
            Le montant est confirmé par l&apos;agence à la validation et ne change plus ensuite. Les
            places sont réservées dès la validation ; le paiement suit.
          </p>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)}>
            Retour
          </Button>
        ) : (
          <span />
        )}
        {/*
          Clés distinctes : sans elles, React réutiliserait le même <button> en passant son type
          de « button » à « submit » pendant le clic sur « Continuer », et le navigateur
          enverrait alors le formulaire (réservation créée sans confirmation).
        */}
        {step < 2 ? (
          <Button key="continuer" type="button" onClick={next}>
            Continuer
          </Button>
        ) : (
          <Button key="confirmer" type="submit" disabled={pending}>
            {pending ? "Réservation…" : "Confirmer la réservation"}
          </Button>
        )}
      </div>
    </form>
  );
}
