"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { CheckboxField } from "@/components/ui/checkbox-field";
import { FormAlert } from "@/components/ui/form-alert";
import { PasswordField } from "@/components/ui/password-field";
import { TextField } from "@/components/ui/text-field";
import { loginAction } from "@/lib/actions/auth";
import { loginSchema } from "@/lib/validators/auth";

import { AUTH_SUBMIT } from "./styles";

/**
 * Formulaire de connexion. `agenceSlug` n'est fourni que sur le site d'une agence
 * (connexion client), avec `retour` quand le client vient du tunnel de réservation (adresse
 * vérifiée côté serveur). La validation Zod s'exécute ici pour un retour immédiat, puis de
 * nouveau côté serveur (qui fait foi). « Se souvenir de moi » : session de 30 jours au lieu
 * de 8 heures.
 */
export function LoginForm({ agenceSlug, retour }: { agenceSlug?: string; retour?: string }) {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", agenceSlug, retour, remember: false },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await loginAction(values);
      if (result.error) setServerError(result.error);
    });
  });

  const oubli = agenceSlug ? `/a/${agenceSlug}/mot-de-passe-oublie` : "/mot-de-passe-oublie";

  return (
    // method="post" : si le formulaire part avant le chargement de JavaScript, les
    // identifiants ne doivent jamais apparaître dans l'URL (historique, journaux).
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-6">
      <FormAlert message={serverError} />
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
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CheckboxField label="Se souvenir de moi" {...register("remember")} />
        <Link href={oubli} className="text-sm font-medium text-gt-teal-700 hover:underline">
          Mot de passe oublié ?
        </Link>
      </div>
      <button type="submit" disabled={pending} className={AUTH_SUBMIT}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
