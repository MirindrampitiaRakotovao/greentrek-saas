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
import { createCircuitAction, updateCircuitAction } from "@/lib/actions/circuits";
import { applyFieldErrors } from "@/lib/forms";
import { slugify } from "@/lib/slug";
import { circuitSchema, DIFFICULTE_LABELS, DIFFICULTES } from "@/lib/validators/circuits";

const DIFFICULTE_OPTIONS = DIFFICULTES.map((d) => ({ value: d, label: DIFFICULTE_LABELS[d] }));
const FIELDS = [
  "titre",
  "slug",
  "resume",
  "description",
  "difficulte",
  "dureeJours",
  "prixParPersonne",
  "capaciteMax",
  "imagePrincipaleUrl",
] as const;

type Circuit = {
  id: string;
  titre: string;
  slug: string;
  resume: string | null;
  description: string | null;
  difficulte: (typeof DIFFICULTES)[number];
  dureeJours: number;
  prixParPersonne: number;
  capaciteMax: number;
  imagePrincipaleUrl: string | null;
};

/** Création (sans `circuit`) ou modification des informations d'un circuit. */
export function CircuitForm({
  circuit,
  devise,
  agenceSlug,
}: {
  circuit?: Circuit;
  devise: string;
  agenceSlug: string;
}) {
  const [serverError, setServerError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [slugEdited, setSlugEdited] = useState(Boolean(circuit));
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(circuitSchema),
    defaultValues: {
      titre: circuit?.titre ?? "",
      slug: circuit?.slug ?? "",
      resume: circuit?.resume ?? "",
      description: circuit?.description ?? "",
      difficulte: circuit?.difficulte ?? "MOYENNE",
      dureeJours: circuit?.dureeJours.toString() ?? "1",
      prixParPersonne: circuit?.prixParPersonne.toString() ?? "",
      capaciteMax: circuit?.capaciteMax.toString() ?? "10",
      imagePrincipaleUrl: circuit?.imagePrincipaleUrl ?? "",
    },
  });
  const slug = useWatch({ control, name: "slug" });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    setSuccess(undefined);
    startTransition(async () => {
      const result = circuit
        ? await updateCircuitAction(circuit.id, values)
        : await createCircuitAction(values); // redirige vers le circuit créé
      setServerError(result.error);
      setSuccess(result.success);
      applyFieldErrors(result.fieldErrors, setError, FIELDS);
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={serverError} />
      <FormSuccess message={success} />
      <TextField
        label="Titre"
        error={errors.titre?.message}
        {...register("titre", {
          onChange: (event: { target: { value: string } }) => {
            if (!slugEdited) setValue("slug", slugify(event.target.value));
          },
        })}
      />
      <TextField
        label="Identifiant dans l'adresse"
        hint={`Page publique : /a/${agenceSlug}/circuits/${slug || "mon-circuit"}`}
        error={errors.slug?.message}
        {...register("slug", { onChange: () => setSlugEdited(true) })}
      />
      <TextField
        label="Résumé (facultatif)"
        hint="Une phrase, affichée sur les cartes du site vitrine."
        error={errors.resume?.message}
        {...register("resume")}
      />
      <TextareaField
        label="Description (facultatif)"
        rows={5}
        error={errors.description?.message}
        {...register("description")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Difficulté"
          options={DIFFICULTE_OPTIONS}
          error={errors.difficulte?.message}
          {...register("difficulte")}
        />
        <TextField
          label="Durée (jours)"
          inputMode="numeric"
          error={errors.dureeJours?.message}
          {...register("dureeJours")}
        />
        <TextField
          label={`Prix par personne (${devise})`}
          inputMode="numeric"
          error={errors.prixParPersonne?.message}
          {...register("prixParPersonne")}
        />
        <TextField
          label="Capacité maximale (personnes)"
          inputMode="numeric"
          error={errors.capaciteMax?.message}
          {...register("capaciteMax")}
        />
      </div>
      <TextField
        label="Adresse de l'image principale (facultatif)"
        type="url"
        placeholder="https://…"
        hint="Photo propre ou libre de droits (§8.1), avec attribution si nécessaire."
        error={errors.imagePrincipaleUrl?.message}
        {...register("imagePrincipaleUrl")}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : circuit ? "Enregistrer" : "Créer le circuit"}
      </Button>
    </form>
  );
}
