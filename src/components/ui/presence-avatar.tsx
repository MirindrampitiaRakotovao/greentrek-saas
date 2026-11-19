import type { Presence } from "@/lib/presence";

import { Avatar } from "./avatar";

/** Photo de profil avec la pastille « en ligne » (verte) ; texte pour les lecteurs d'écran. */
export function PresenceAvatar({
  name,
  src,
  presence,
  size = 40,
}: {
  name: string;
  src?: string | null;
  presence?: Presence | null;
  size?: number;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar name={name} src={src} size={size} />
      {presence?.enLigne ? (
        <span
          className="absolute right-0 bottom-0 size-3 rounded-full bg-emerald-500 ring-2 ring-white"
          style={{ width: Math.max(10, size * 0.28), height: Math.max(10, size * 0.28) }}
        >
          <span className="sr-only">en ligne</span>
        </span>
      ) : null}
    </span>
  );
}

/** Libellé de présence : « En ligne » ou « vu il y a … » (rien si masqué). */
export function presenceText(presence: Presence | null | undefined): string | null {
  if (!presence) return null;
  return presence.enLigne ? "En ligne" : presence.vu;
}
