"use client";

import { useState, useTransition } from "react";

import { useNotify } from "@/components/ui/dialogs";
import { FormAlert } from "@/components/ui/form-alert";
import { answerDemandeAction, answerItineraireAction } from "@/lib/actions/itineraires-perso";

/**
 * Réponse à un itinéraire, avec un mot facultatif : le voyageur répond à une proposition de
 * l'agence (`as="client"`), ou l'agence à la demande d'un voyageur (`as="agence"`).
 */
export function AnswerItineraire({ id, as = "client" }: { id: string; as?: "client" | "agence" }) {
  const notify = useNotify();
  const [reponse, setReponse] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function answer(decision: "ACCEPTE" | "DECLINE") {
    setError(undefined);
    startTransition(async () => {
      const action = as === "agence" ? answerDemandeAction : answerItineraireAction;
      const result = await action({ id, decision, reponse });
      if (result.error) return setError(result.error);
      if (result.success) notify(result.success);
    });
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gt-teal-900">
        {as === "agence" ? "Réponse au voyageur (facultatif)" : "Un mot pour l'agence (facultatif)"}
        <textarea
          value={reponse}
          onChange={(e) => setReponse(e.target.value)}
          rows={3}
          maxLength={1000}
          className="mt-1 w-full rounded-xl border border-gt-mist bg-white px-3 py-2 text-sm"
        />
      </label>
      <FormAlert message={error} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => answer("ACCEPTE")}
          className="rounded-full bg-gt-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-gt-teal-800 disabled:opacity-50"
        >
          {as === "agence" ? "Accepter la demande" : "Accepter cet itinéraire"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => answer("DECLINE")}
          className="rounded-full border border-gt-teal-700 px-5 py-2.5 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50 disabled:opacity-50"
        >
          Décliner
        </button>
      </div>
    </div>
  );
}
