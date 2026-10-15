"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

import { FormAlert } from "@/components/ui/form-alert";
import { PasswordField } from "@/components/ui/password-field";
import { TextField } from "@/components/ui/text-field";
import { registerAgencyAction } from "@/lib/actions/auth";
import { slugify } from "@/lib/slug";
import { type AgencyRegistrationInput, agencyRegistrationSchema } from "@/lib/validators/auth";

import { AUTH_SUBMIT } from "./styles";

const FIELDS = [
  "nomAgence",
  "slug",
  "prenom",
  "nom",
  "email",
  "password",
  "confirmPassword",
] as const satisfies readonly (keyof AgencyRegistrationInput)[];

/** Inscription d'une agence : agence, compte administrateur et période d'essai. */
export function RegisterAgencyForm() {
  const [serverError, setServerError] = useState<string>();
  const [slugEdited, setSlugEdited] = useState(false);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(agencyRegistrationSchema),
    defaultValues: {
      nomAgence: "",
      slug: "",
      prenom: "",
      nom: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const slug = useWatch({ control, name: "slug" });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await registerAgencyAction(values);
      if (!result.error) return;
      setServerError(result.error);
      for (const field of FIELDS) {
        const message = result.fieldErrors?.[field];
        if (message) setError(field, { message });
      }
    });
  });

  return (
    // method="post" : si le formulaire part avant le chargement de JavaScript, les
    // identifiants ne doivent jamais apparaître dans l'URL (historique, journaux).
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-6">
      <FormAlert message={serverError} />
      <fieldset className="space-y-6">
        <legend className="text-sm font-semibold tracking-wide text-gt-teal-700 uppercase">
          Votre agence
        </legend>
        <TextField
          appearance="encadre"
          label="Nom de l'agence"
          error={errors.nomAgence?.message}
          {...register("nomAgence", {
            // Tant que l'identifiant n'a pas été modifié à la main, il suit le nom.
            onChange: (event: { target: { value: string } }) => {
              if (!slugEdited) setValue("slug", slugify(event.target.value));
            },
          })}
        />
        <TextField
          appearance="encadre"
          label="Identifiant dans l'adresse du site"
          hint={`Votre site : /a/${slug || "mon-agence"}`}
          error={errors.slug?.message}
          {...register("slug", { onChange: () => setSlugEdited(true) })}
        />
      </fieldset>

      <fieldset className="space-y-6">
        <legend className="text-sm font-semibold tracking-wide text-gt-teal-700 uppercase">
          Compte administrateur
        </legend>
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField
            appearance="encadre"
            label="Prénom"
            autoComplete="given-name"
            error={errors.prenom?.message}
            {...register("prenom")}
          />
          <TextField
            appearance="encadre"
            label="Nom"
            autoComplete="family-name"
            error={errors.nom?.message}
            {...register("nom")}
          />
        </div>
        <TextField
          appearance="encadre"
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <PasswordField
          appearance="encadre"
          label="Mot de passe"
          autoComplete="new-password"
          hint="8 caractères minimum, avec une majuscule, une minuscule et un chiffre."
          error={errors.password?.message}
          {...register("password")}
        />
        <PasswordField
          appearance="encadre"
          label="Confirmation du mot de passe"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
      </fieldset>

      <button type="submit" disabled={pending} className={AUTH_SUBMIT}>
        {pending ? "Création de l'agence…" : "Créer mon agence (essai de 30 jours)"}
      </button>
    </form>
  );
}
