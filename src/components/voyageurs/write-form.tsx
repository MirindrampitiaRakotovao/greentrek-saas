"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { startPrivateConversationAction } from "@/lib/actions/voyageurs";
import { MESSAGE_MAX } from "@/lib/validators/messagerie";

/** Premier message à un autre voyageur ; ouvre ensuite la conversation (redirection). */
export function WriteForm({ destinataireId }: { destinataireId: string }) {
  const [contenu, setContenu] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        startTransition(async () => {
          const result = await startPrivateConversationAction({ destinataireId, contenu });
          if (result?.error) setError(result.error);
        });
      }}
      className="space-y-3"
    >
      <FormAlert message={error} />
      <label className="block text-sm font-medium text-gt-teal-900">
        Votre message
        <textarea
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          rows={4}
          maxLength={MESSAGE_MAX}
          required
          placeholder="Bonjour ! Vous avez fait ce circuit ? …"
          className="mt-1 w-full rounded-xl border border-gt-mist px-3 py-2 text-sm"
        />
      </label>
      <p className="text-xs text-gt-teal-900/75">
        Seuls vos prénom, initiale et photo sont visibles. L&apos;agence ne lit pas cette
        conversation, sauf un message qui lui est signalé.
      </p>
      <Button type="submit" disabled={pending || !contenu.trim()}>
        {pending ? "Envoi…" : "Envoyer"}
      </Button>
    </form>
  );
}
