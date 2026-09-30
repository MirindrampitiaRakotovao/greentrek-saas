"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { startConversationAction } from "@/lib/actions/messagerie";
import { applyFieldErrors } from "@/lib/forms";
import { MESSAGE_MAX, startConversationSchema } from "@/lib/validators/messagerie";

/**
 * Premier message d'une conversation : au sujet d'une réservation (`reservationId`), ou
 * question générale d'un voyageur (avec un sujet). Après l'envoi, le fil s'ouvre.
 */
export function StartConversationForm({
  reservationId = null,
  placeholder,
}: {
  reservationId?: string | null;
  placeholder?: string;
}) {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(startConversationSchema),
    defaultValues: { reservationId, sujet: "", contenu: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      // En cas de succès, l'action ouvre le fil (redirection) : rien à faire ici.
      const result = await startConversationAction(values);
      setServerError(result.error);
      applyFieldErrors(result.fieldErrors, setError, ["sujet", "contenu"] as const);
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={serverError} />
      {reservationId ? null : (
        <TextField
          label="Sujet"
          placeholder="Ex. : circuit en famille"
          maxLength={200}
          error={errors.sujet?.message}
          {...register("sujet")}
        />
      )}
      <TextareaField
        label="Votre message"
        rows={5}
        maxLength={MESSAGE_MAX}
        placeholder={placeholder}
        error={errors.contenu?.message}
        {...register("contenu")}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Envoi…" : "Envoyer"}
      </Button>
    </form>
  );
}
