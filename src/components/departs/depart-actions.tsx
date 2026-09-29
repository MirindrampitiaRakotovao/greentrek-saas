"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSuccess } from "@/components/ui/form-success";
import { cancelDepartAction, deleteDepartAction } from "@/lib/actions/departs";

/**
 * Annulation (décision D : ses réservations actives sont annulées aussi, après confirmation)
 * et suppression (seulement si le départ n'a jamais reçu de réservation).
 */
export function DepartActions({
  id,
  reservationsActives,
  canCancel,
  canDelete,
}: {
  id: string;
  reservationsActives: number;
  canCancel: boolean;
  canDelete: boolean;
}) {
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [pending, startTransition] = useTransition();

  function cancel() {
    const message =
      reservationsActives > 0
        ? `Annuler ce départ ? Ses ${reservationsActives} réservation(s) active(s) seront annulées elles aussi. Cette action est définitive.`
        : "Annuler ce départ ? Cette action est définitive.";
    if (!window.confirm(message)) return;
    setError(undefined);
    startTransition(async () => {
      const result = await cancelDepartAction({ id });
      setError(result.error);
      setSuccess(result.success);
    });
  }

  return (
    <div className="space-y-3">
      <FormAlert message={error} />
      <FormSuccess message={success} />
      <div className="flex flex-wrap items-start gap-3">
        {canCancel ? (
          <Button type="button" variant="secondary" disabled={pending} onClick={cancel}>
            {pending ? "Annulation…" : "Annuler le départ"}
          </Button>
        ) : null}
        {canDelete ? (
          <DeleteButton
            id={id}
            label="Supprimer le départ"
            confirmMessage="Supprimer définitivement ce départ ? (Impossible s'il a déjà reçu des réservations.)"
            action={deleteDepartAction}
          />
        ) : null}
      </div>
    </div>
  );
}
