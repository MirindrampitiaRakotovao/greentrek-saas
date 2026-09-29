"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSuccess } from "@/components/ui/form-success";
import { cancelReservationAction } from "@/lib/actions/reservations";

/** Annulation par le client, après confirmation (RG 15 vérifiée côté serveur). */
export function CancelReservationButton({ id, reference }: { id: string; reference: string }) {
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (
      !window.confirm(
        `Annuler la réservation ${reference} ? Les places seront libérées ; cette action est définitive.`,
      )
    ) {
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await cancelReservationAction({ id });
      setError(result.error);
      setSuccess(result.success);
    });
  }

  return (
    <div className="space-y-3">
      <FormAlert message={error} />
      <FormSuccess message={success} />
      <Button type="button" variant="secondary" disabled={pending} onClick={onClick}>
        {pending ? "Annulation…" : "Annuler la réservation"}
      </Button>
    </div>
  );
}
