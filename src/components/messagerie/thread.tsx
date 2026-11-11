"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { playSentSound } from "@/components/shell/realtime";
import { Icon } from "@/components/ui/icon";
import type { Role } from "@/generated/prisma/client";
import { markConversationReadAction, sendMessageAction } from "@/lib/actions/messagerie";
import { formatDate, formatTime } from "@/lib/format";
import { type DeliveryStatus, messagingSide, SIDE_LABELS } from "@/lib/messagerie";
import { MESSAGE_MAX, messageSchema } from "@/lib/validators/messagerie";

export type ThreadMessage = {
  id: string;
  contenu: string;
  createdAt: Date;
  auteur: { id: string; prenom: string; nom: string; role: Role };
  /** Accusé de lecture de mes messages (calculé par le service), null pour les autres. */
  statut: DeliveryStatus | null;
};

/** Message en cours d'envoi (affiché tout de suite), ou dont l'envoi a échoué. */
type Outgoing = { key: number; contenu: string; etat: "ENVOI" | "ENVOYE" | "ECHEC" };

/**
 * Fil d'une conversation (messagerie, après E12). Les messages de « mon côté » (moi, ou mes
 * collègues de l'agence dans la boîte partagée) sont à droite, avec leur statut : envoi en
 * cours, distribué (✓, enregistré) ou lu par l'autre côté (✓✓). Les nouveaux messages et les
 * accusés de lecture arrivent par le canal temps réel, qui relit la page (`router.refresh`) ;
 * le fil défile alors en bas et la conversation est marquée comme lue.
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
  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  const nextKey = useRef(0);

  // Nouveau dernier message (ou ouverture) : défilement en bas, puis « lu » et relecture
  // de la page pour mettre à jour la pastille du menu et la liste. Les messages envoyés
  // sont alors dans le fil : ils quittent la file d'envoi.
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

  const [seenLastId, setSeenLastId] = useState(lastId);
  if (seenLastId !== lastId) {
    setSeenLastId(lastId);
    setOutbox((items) => items.filter((o) => o.etat !== "ENVOYE"));
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [outbox.length]);

  async function deliver(item: Outgoing) {
    const result = await sendMessageAction({ conversationId, contenu: item.contenu });
    const ok = !result.error && !result.fieldErrors;
    setOutbox((items) =>
      items.map((o) => (o.key === item.key ? { ...o, etat: ok ? "ENVOYE" : "ECHEC" } : o)),
    );
    if (ok) {
      playSentSound();
      router.refresh();
    }
  }

  function send(contenu: string) {
    const item: Outgoing = { key: nextKey.current++, contenu, etat: "ENVOI" };
    setOutbox((items) => [...items, item]);
    void deliver(item);
  }

  function retry(item: Outgoing) {
    setOutbox((items) => items.map((o) => (o.key === item.key ? { ...o, etat: "ENVOI" } : o)));
    void deliver({ ...item, etat: "ENVOI" });
  }

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
                  <Bubble mine={mine}>{m.contenu}</Bubble>
                  {m.statut ? <Status statut={m.statut} /> : null}
                </div>
              </div>
            </li>
          );
        })}
        {outbox.map((o) => (
          <li key={`envoi-${o.key}`}>
            <div className="flex justify-end">
              <div className="max-w-[85%] sm:max-w-[70%]">
                <Bubble mine dim={o.etat !== "ECHEC"}>
                  {o.contenu}
                </Bubble>
                {o.etat === "ECHEC" ? (
                  <button
                    type="button"
                    onClick={() => retry(o)}
                    className="mt-1 block w-full text-right text-xs font-medium text-red-700 underline"
                  >
                    Non envoyé · toucher pour réessayer
                  </button>
                ) : (
                  <Status statut={o.etat === "ENVOYE" ? "DISTRIBUE" : "ENVOI"} />
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
      <Composer conversationId={conversationId} onSend={send} />
    </div>
  );
}

function Bubble({
  mine,
  dim = false,
  children,
}: {
  mine: boolean;
  dim?: boolean;
  children: string;
}) {
  return (
    <p
      className={`rounded-2xl px-4 py-2.5 text-sm break-words whitespace-pre-line ${
        mine
          ? "rounded-br-md bg-gt-teal-700 text-white"
          : "rounded-bl-md bg-white text-gt-teal-900 ring-1 ring-gt-mist"
      } ${dim ? "opacity-70" : ""}`}
    >
      {children}
    </p>
  );
}

const STATUS = {
  ENVOI: { icon: "clock", label: "Envoi…" },
  DISTRIBUE: { icon: "check", label: "Distribué" },
  LU: { icon: "checkDouble", label: "Lu" },
} as const;

/** Statut sous un de mes messages : pictogramme ET texte (jamais la couleur seule). */
function Status({ statut }: { statut: keyof typeof STATUS }) {
  const { icon, label } = STATUS[statut];
  return (
    <p
      className={`mt-1 flex items-center justify-end gap-1 text-xs ${
        statut === "LU" ? "font-medium text-gt-teal-700" : "text-gt-teal-900/75"
      }`}
    >
      <Icon name={icon} className="size-3.5" />
      {label}
    </p>
  );
}

function Composer({
  conversationId,
  onSend,
}: {
  conversationId: string;
  onSend: (contenu: string) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(messageSchema),
    defaultValues: { conversationId, contenu: "" },
  });
  // Le message part tout de suite dans le fil (« Envoi… ») et la zone de saisie se vide.
  const onSubmit = handleSubmit((values) => {
    onSend(values.contenu);
    reset({ conversationId, contenu: "" });
  });

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      noValidate
      className="border-t border-gt-mist/70 bg-white px-4 py-3 sm:px-6"
    >
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
          className="grid size-11 shrink-0 place-items-center rounded-full bg-gt-teal-700 text-white hover:bg-gt-teal-800"
        >
          <Icon name="send" className="size-5" />
          <span className="sr-only">Envoyer</span>
        </button>
      </div>
      <p id="message-aide" className="mt-1 text-xs text-gt-teal-900/75">
        {errors.contenu?.message ?? "Entrée pour envoyer · Maj + Entrée pour aller à la ligne"}
      </p>
    </form>
  );
}
