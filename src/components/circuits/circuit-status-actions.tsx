"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { FormAlert } from "@/components/ui/form-alert";
import type { StatutCircuit } from "@/generated/prisma/client";
import { deleteCircuitAction, setCircuitStatutAction } from "@/lib/actions/circuits";

/** Publication (RG 4 : au moins deux étapes), retour en brouillon, archivage, suppression. */
export function CircuitStatusActions({
  id,
  titre,
  statut,
  canDelete,
}: {
  id: string;
  titre: string;
  statut: StatutCircuit;
  canDelete: boolean;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function change(next: StatutCircuit) {
    setError(undefined);
    startTransition(async () => {
      const result = await setCircuitStatutAction({ id, statut: next });
      setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <FormAlert message={error} />
      <div className="flex flex-wrap gap-2">
        {statut !== "PUBLIE" ? (
          <Button type="button" disabled={pending} onClick={() => change("PUBLIE")}>
            Publier
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => change("BROUILLON")}
          >
            Repasser en brouillon
          </Button>
        )}
        {statut !== "ARCHIVE" ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => change("ARCHIVE")}
          >
            Archiver
          </Button>
        ) : null}
      </div>
      {canDelete ? (
        <DeleteButton
          id={id}
          label="Supprimer le circuit"
          confirmMessage={`Supprimer définitivement « ${titre} » ? (Impossible s'il a déjà des départs.)`}
          action={deleteCircuitAction}
        />
      ) : null}
    </div>
  );
}
