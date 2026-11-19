"use client";

import { useState, useTransition } from "react";

import { useNotify } from "@/components/ui/dialogs";
import { FormAlert } from "@/components/ui/form-alert";
import { answerItineraireAction } from "@/lib/actions/itineraires-perso";

/** Réponse du voyageur à l'itinéraire proposé : accepter ou décliner, avec un mot facultatif. */
export function AnswerItineraire({ id }: { id: string }) {
  const notify = useNotify();
  const [reponse, setReponse] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function answer(decision: "ACCEPTE" | "DECLINE") {
    setError(undefined);
    startTransition(async () => {
      const result = await answerItineraireAction({ id, decision, reponse });
      if (result.error) return setError(result.error);
      if (result.success) notify(result.success);
    });
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gt-teal-900">
        Un mot pour l&apos;agence (facultatif)
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
          Accepter cet itinéraire
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
