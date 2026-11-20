"use client";

import { useState, useTransition } from "react";

import { useNotify } from "@/components/ui/dialogs";
import { setJaimeAction } from "@/lib/actions/communaute";

/** « J'aime » : bascule immédiate (rétablie si le serveur refuse). */
export function LikeButton({
  publicationId,
  jAime,
  jaimes,
}: {
  publicationId: string;
  jAime: boolean;
  jaimes: number;
}) {
  const notify = useNotify();
  const [state, setState] = useState({ jAime, jaimes });
  const [pending, startTransition] = useTransition();

  function toggle() {
    const before = state;
    const next = { jAime: !state.jAime, jaimes: state.jaimes + (state.jAime ? -1 : 1) };
    setState(next);
    startTransition(async () => {
      const result = await setJaimeAction({ publicationId, jaime: next.jAime });
      if (result.error) {
        setState(before);
        notify(result.error, "error");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={state.jAime}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-gt-teal-900 hover:bg-gt-teal-50"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`size-5 ${state.jAime ? "text-red-600" : ""}`}
        fill={state.jAime ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinejoin="round"
      >
        <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z" />
      </svg>
      <span>
        {state.jaimes}
        <span className="sr-only"> J&apos;aime</span>
      </span>
    </button>
  );
}
