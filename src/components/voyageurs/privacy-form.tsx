"use client";

import { useState, useTransition } from "react";

import { useNotify } from "@/components/ui/dialogs";
import { updatePrivacyAction } from "@/lib/actions/voyageurs";

/** Confidentialité du voyageur : présence visible, messages des autres voyageurs. */
export function PrivacyForm({
  presenceVisible,
  messagesVoyageurs,
}: {
  presenceVisible: boolean;
  messagesVoyageurs: boolean;
}) {
  const notify = useNotify();
  const [values, setValues] = useState({ presenceVisible, messagesVoyageurs });
  const [pending, startTransition] = useTransition();

  function change(next: typeof values) {
    setValues(next);
    startTransition(async () => {
      const result = await updatePrivacyAction(next);
      notify(result.error ?? result.success ?? "", result.error ? "error" : "success");
    });
  }

  return (
    <fieldset className="space-y-3" disabled={pending}>
      <legend className="sr-only">Confidentialité</legend>
      <label className="flex items-start gap-3 text-sm text-gt-teal-900">
        <input
          type="checkbox"
          checked={values.presenceVisible}
          onChange={(e) => change({ ...values, presenceVisible: e.target.checked })}
          className="mt-0.5 size-4 accent-gt-teal-700"
        />
        <span>
          <span className="font-medium">Montrer quand je suis en ligne</span>
          <span className="block text-xs text-gt-teal-900/75">
            Sinon, personne ne voit « en ligne » ni « vu il y a … » pour vous.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm text-gt-teal-900">
        <input
          type="checkbox"
          checked={values.messagesVoyageurs}
          onChange={(e) => change({ ...values, messagesVoyageurs: e.target.checked })}
          className="mt-0.5 size-4 accent-gt-teal-700"
        />
        <span>
          <span className="font-medium">Recevoir des messages des autres voyageurs</span>
          <span className="block text-xs text-gt-teal-900/75">
            Sinon, vous n&apos;apparaissez pas dans la liste des voyageurs et personne ne peut
            ouvrir une nouvelle conversation avec vous.
          </span>
        </span>
      </label>
    </fieldset>
  );
}
