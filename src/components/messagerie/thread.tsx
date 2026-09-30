"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { FormAlert } from "@/components/ui/form-alert";
import { Icon } from "@/components/ui/icon";
import type { Role } from "@/generated/prisma/client";
import { markConversationReadAction, sendMessageAction } from "@/lib/actions/messagerie";
import { applyFieldErrors } from "@/lib/forms";
import { formatDate, formatTime } from "@/lib/format";
import { messagingSide, SIDE_LABELS } from "@/lib/messagerie";
import { MESSAGE_MAX, messageSchema } from "@/lib/validators/messagerie";

export type ThreadMessage = {
  id: string;
  contenu: string;
  createdAt: Date;
  auteur: { id: string; prenom: string; nom: string; role: Role };
};

/**
 * Fil d'une conversation (messagerie, après E12). Les messages de « mon côté » (moi, ou mes
 * collègues de l'agence dans la boîte partagée) sont à droite. Les nouveaux messages arrivent
 * par le canal temps réel, qui relit la page (`router.refresh`) ; le fil défile alors en bas
 * et la conversation est marquée comme lue.
 */
export function Thread({
  conversationId,
  messages,
  viewerId,
  viewerRole,
}: {
  conversationId: string;
  messages: readonly ThreadMessage[];
  viewerId: string;
  viewerRole: Role;
}) {
  const router = useRouter();
  const listRef = useRef<HTMLOListElement>(null);
  const lastId = messages.at(-1)?.id;

  // Nouveau dernier message (ou ouverture) : défilement en bas, puis « lu » et relecture
  // de la page pour mettre à jour la pastille du menu et la liste.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    let cancelled = false;
    void markConversationReadAction({ conversationId }).then(() => {
      if (!cancelled) router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId, lastId, router]);

  const mySide = messagingSide(viewerRole);
  const days = messages.map((m) => formatDate(m.createdAt));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ol
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label="Messages"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6"
      >
        {messages.map((m, index) => {
          const day = days[index]!;
          const separator = index === 0 || day !== days[index - 1];
          const side = messagingSide(m.auteur.role);
          const mine = side === mySide;
          const me = m.auteur.id === viewerId;
          return (
            <li key={m.id}>
              {separator ? (
                <p className="my-3 text-center text-xs font-medium text-gt-teal-900/75">{day}</p>
              ) : null}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%] sm:max-w-[70%]">
                  <p
                    className={`mb-1 text-xs text-gt-teal-900/75 ${mine ? "text-right" : "text-left"}`}
                  >
                    {me ? "Vous" : `${m.auteur.prenom} ${m.auteur.nom.charAt(0)}.`}
                    {!me && SIDE_LABELS[side] ? ` · ${SIDE_LABELS[side]}` : ""} ·{" "}
                    <time dateTime={m.createdAt.toISOString()}>{formatTime(m.createdAt)}</time>
                  </p>
                  <p
                    className={`rounded-2xl px-4 py-2.5 text-sm break-words whitespace-pre-line ${
                      mine
                        ? "rounded-br-md bg-gt-teal-700 text-white"
                        : "rounded-bl-md bg-white text-gt-teal-900 ring-1 ring-gt-mist"
                    }`}
                  >
                    {m.contenu}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <Composer conversationId={conversationId} />
    </div>
  );
}

function Composer({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(messageSchema),
    defaultValues: { conversationId, contenu: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await sendMessageAction(values);
      if (result.error || result.fieldErrors) {
        setServerError(result.error);
        applyFieldErrors(result.fieldErrors, setError, ["contenu"] as const);
        return;
      }
      reset({ conversationId, contenu: "" });
      router.refresh();
    });
  });

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      noValidate
      className="border-t border-gt-mist/70 bg-white px-4 py-3 sm:px-6"
    >
      <FormAlert message={serverError} />
      <div className="flex items-end gap-2">
        <label htmlFor="message-contenu" className="sr-only">
          Votre message
        </label>
        <textarea
          id="message-contenu"
          rows={2}
          maxLength={MESSAGE_MAX}
          placeholder="Écrivez votre message…"
          aria-invalid={errors.contenu ? true : undefined}
          aria-describedby="message-aide"
          className="block max-h-40 min-h-11 flex-1 resize-y rounded-2xl border border-gt-mist bg-white px-4 py-2.5 text-sm text-gt-teal-900 outline-none placeholder:text-gt-teal-900/60 focus:border-gt-teal-600 focus:ring-2 focus:ring-gt-teal-500/30 aria-invalid:border-red-600"
          {...register("contenu")}
          onKeyDown={(event) => {
            // Entrée envoie, Maj + Entrée va à la ligne (usage des messageries).
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void onSubmit();
            }
          }}
        />
        <button
          type="submit"
          disabled={pending}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-gt-teal-700 text-white hover:bg-gt-teal-800 disabled:opacity-60"
        >
          <Icon name="send" className="size-5" />
          <span className="sr-only">{pending ? "Envoi…" : "Envoyer"}</span>
        </button>
      </div>
      <p id="message-aide" className="mt-1 text-xs text-gt-teal-900/75">
        {errors.contenu?.message ?? "Entrée pour envoyer · Maj + Entrée pour aller à la ligne"}
      </p>
    </form>
  );
}
