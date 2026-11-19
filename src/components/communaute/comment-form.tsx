"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { addCommentaireAction } from "@/lib/actions/communaute";
import { COMMENTAIRE_MAX } from "@/lib/validators/communaute";

export function CommentForm({ publicationId }: { publicationId: string }) {
  const router = useRouter();
  const [contenu, setContenu] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        startTransition(async () => {
          const result = await addCommentaireAction({ publicationId, contenu });
          if (result.error) return setError(result.error);
          setContenu("");
          router.refresh();
        });
      }}
      className="space-y-2"
    >
      <FormAlert message={error} />
      <label htmlFor="nouveau-commentaire" className="sr-only">
        Votre commentaire
      </label>
      <textarea
        id="nouveau-commentaire"
        value={contenu}
        onChange={(e) => setContenu(e.target.value)}
        rows={2}
        maxLength={COMMENTAIRE_MAX}
        placeholder="Votre commentaire…"
        className="w-full rounded-xl border border-gt-mist px-3 py-2 text-sm"
      />
      <Button type="submit" disabled={pending || !contenu.trim()}>
        {pending ? "Envoi…" : "Commenter"}
      </Button>
    </form>
  );
}
