"use client";

import { useRouter } from "next/navigation";

import { EXPERT_COOKIE } from "@/lib/expert-mode";

/**
 * Interrupteur « Mode expert » : affiche les algorithmes et leurs mesures (soutenance,
 * mémoire). Préférence de ce navigateur (cookie d'un an), puis relecture de la page.
 */
export function ExpertToggle({ expert }: { expert: boolean }) {
  const router = useRouter();
  function toggle() {
    document.cookie = `${EXPERT_COOKIE}=${expert ? "0" : "1"}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={expert}
      onClick={toggle}
      className="flex items-center gap-3 rounded-full border border-gt-mist bg-white px-3 py-1.5 text-sm text-gt-teal-900 hover:border-gt-teal-600"
    >
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 rounded-full transition-colors ${expert ? "bg-gt-teal-700" : "bg-gt-mist"}`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] ${expert ? "left-[18px]" : "left-0.5"}`}
        />
      </span>
      <span>
        <span className="font-medium">Mode expert</span>
        <span className="hidden text-gt-teal-900/75 sm:inline"> · algorithmes et mesures</span>
      </span>
    </button>
  );
}
