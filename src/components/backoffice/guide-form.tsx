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
import { createGuideAction, updateGuideAction } from "@/lib/actions/backoffice";
import { applyFieldErrors } from "@/lib/forms";
import { guideSchema, LANGUE_LABELS, LANGUES } from "@/lib/validators/backoffice";

const FIELDS = [
  "prenom",
  "nom",
  "telephone",
  "bio",
  "langues",
  "experienceAnnees",
  "actif",
  "utilisateurId",
] as const;

type Guide = {
  id: string;
  prenom: string;
  nom: string;
  telephone: string | null;
  bio: string | null;
  langues: string[];
  experienceAnnees: number | null;
  actif: boolean;
  utilisateurId: string | null;
};

type Account = { id: string; prenom: string; nom: string; email: string };

/** Création (sans `guide`) ou modification d'une fiche guide. */
export function GuideForm({ guide, accounts }: { guide?: Guide; accounts: readonly Account[] }) {
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
    resolver: zodResolver(guideSchema),
    defaultValues: {
      prenom: guide?.prenom ?? "",
      nom: guide?.nom ?? "",
      telephone: guide?.telephone ?? "",
      bio: guide?.bio ?? "",
      langues: guide?.langues ?? [],
      experienceAnnees: guide?.experienceAnnees?.toString() ?? "",
      actif: guide?.actif ?? true,
      utilisateurId: guide?.utilisateurId ?? "",
    },
  });

  const accountOptions = [
    { value: "", label: "Aucun compte (guide sans accès à la plateforme)" },
    ...accounts.map((account) => ({
      value: account.id,
      label: `${account.prenom} ${account.nom} (${account.email})`,
    })),
  ];

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    setSuccess(undefined);
    startTransition(async () => {
      const result = guide
        ? await updateGuideAction(guide.id, values)
        : await createGuideAction(values); // redirige vers la liste en cas de succès
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
        <TextField label="Prénom" error={errors.prenom?.message} {...register("prenom")} />
        <TextField label="Nom" error={errors.nom?.message} {...register("nom")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Téléphone (facultatif)"
          type="tel"
          error={errors.telephone?.message}
          {...register("telephone")}
        />
        <TextField
          label="Années d'expérience (facultatif)"
          inputMode="numeric"
          error={errors.experienceAnnees?.message}
          {...register("experienceAnnees")}
        />
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-gt-teal-900">Langues parlées</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LANGUES.map((code) => (
            <CheckboxField
              key={code}
              label={LANGUE_LABELS[code]}
              value={code}
              {...register("langues")}
            />
          ))}
        </div>
        {errors.langues?.message ? (
          <p className="mt-1 text-sm text-red-700">{errors.langues.message}</p>
        ) : null}
      </fieldset>
      <TextareaField
        label="Présentation (facultatif)"
        hint="Parcours, spécialités : affichée aux voyageurs sur le site vitrine."
        error={errors.bio?.message}
        {...register("bio")}
      />
      <SelectField
        label="Compte de connexion relié"
        options={accountOptions}
        error={errors.utilisateurId?.message}
        {...register("utilisateurId")}
      />
      <CheckboxField label="Guide actif" {...register("actif")} />
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : guide ? "Enregistrer" : "Ajouter le guide"}
      </Button>
    </form>
  );
}
