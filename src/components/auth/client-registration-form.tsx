"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import { registerClientAction } from "@/lib/actions/auth";
import { applyFieldErrors } from "@/lib/forms";
import { clientRegistrationSchema } from "@/lib/validators/auth";

const FIELDS = ["prenom", "nom", "email", "telephone", "password", "confirmPassword"] as const;

/** Création d'un compte voyageur sur le site d'une agence (§7.2). */
export function ClientRegistrationForm({
  agenceSlug,
  retour,
}: {
  agenceSlug: string;
  retour?: string;
}) {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(clientRegistrationSchema),
    defaultValues: {
      agenceSlug,
      retour,
      prenom: "",
      nom: "",
      email: "",
      telephone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      // Succès : connexion automatique et redirection (exception gérée par Next.js).
      const result = await registerClientAction(values);
      setServerError(result.error);
      applyFieldErrors(result.fieldErrors, setError, FIELDS);
    });
  });

  return (
    // method="post" : le mot de passe ne doit jamais apparaître dans l'URL.
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={serverError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Prénom"
          autoComplete="given-name"
          error={errors.prenom?.message}
          {...register("prenom")}
        />
        <TextField
          label="Nom"
          autoComplete="family-name"
          error={errors.nom?.message}
          {...register("nom")}
        />
      </div>
      <TextField
        label="Adresse e-mail"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <TextField
        label="Téléphone (facultatif)"
        type="tel"
        autoComplete="tel"
        error={errors.telephone?.message}
        {...register("telephone")}
      />
      <TextField
        label="Mot de passe"
        type="password"
        autoComplete="new-password"
        hint="8 caractères au moins, avec une majuscule, une minuscule et un chiffre."
        error={errors.password?.message}
        {...register("password")}
      />
      <TextField
        label="Confirmer le mot de passe"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Création du compte…" : "Créer mon compte"}
      </Button>
    </form>
  );
}
