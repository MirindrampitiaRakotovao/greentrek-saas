"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useNotify } from "@/components/ui/dialogs";
import { Icon } from "@/components/ui/icon";
import type { RealtimeEvent } from "@/lib/realtime/events";

/*
 * Temps réel côté navigateur (après E12) : écoute du canal `/api/temps-reel` (Server-Sent
 * Events), son, notification à l'écran et rafraîchissement des données de la page.
 */

const SOUND_KEY = "gt-son";
const SOUNDS = { notification: "/sons/notification.wav", message: "/sons/message.wav" } as const;

/** Préférence « son activé » de ce navigateur (confort personnel : stockage local). */
export function useSoundPreference(): [boolean, () => void] {
  const [on, setOn] = useState(true);
  useEffect(() => {
    try {
      // Lecture après l'hydratation : le serveur ne connaît pas le stockage du navigateur.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOn(window.localStorage.getItem(SOUND_KEY) !== "off");
    } catch {
      // stockage indisponible (navigation privée stricte) : son activé par défaut
    }
  }, []);
  const toggle = useCallback(() => {
    setOn((value) => {
      try {
        window.localStorage.setItem(SOUND_KEY, value ? "off" : "on");
      } catch {
        // préférence non conservée, mais appliquée pour cette page
      }
      return !value;
    });
  }, []);
  return [on, toggle];
}

/**
 * Connexion au canal temps réel. À chaque événement : son (si activé), notification à
 * l'écran, puis `router.refresh()` pour relire la base (cloche, compteurs, fil ouvert).
 * Les navigateurs n'autorisent un son qu'après une première interaction avec la page : avant
 * cela, le son est simplement ignoré.
 */
export function RealtimeBridge({ soundOn }: { soundOn: boolean }) {
  const router = useRouter();
  const notify = useNotify();
  const soundOnRef = useRef(soundOn);
  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    const audio = {
      notification: new Audio(SOUNDS.notification),
      message: new Audio(SOUNDS.message),
    };
    let lastSound = 0;
    let refreshTimer: number | undefined;

    function play(kind: keyof typeof audio) {
      const now = Date.now();
      if (!soundOnRef.current || now - lastSound < 1200) return; // pas de rafale de sons
      lastSound = now;
      audio[kind].currentTime = 0;
      audio[kind].play().catch(() => {
        // lecture refusée par le navigateur (aucune interaction encore) : sans conséquence
      });
    }

    function refreshSoon() {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => router.refresh(), 300);
    }

    function handle(event: RealtimeEvent) {
      if (event.type === "notification") {
        play("notification");
        notify(event.titre, "info");
      } else {
        play("message");
        notify(`Nouveau message de ${event.auteur} : ${event.extrait}`, "info");
        window.dispatchEvent(new CustomEvent("gt:message", { detail: event }));
      }
      refreshSoon();
    }

    const source = new EventSource("/api/temps-reel");
    const listener = (e: MessageEvent<string>) => {
      try {
        handle(JSON.parse(e.data) as RealtimeEvent);
      } catch {
        // événement illisible : ignoré
      }
    };
    source.addEventListener("notification", listener);
    source.addEventListener("message", listener);
    return () => {
      window.clearTimeout(refreshTimer);
      source.close();
    };
  }, [router, notify]);

  return null;
}

/** Bouton de l'en-tête : son des notifications et des messages activé ou coupé. */
export function SoundToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      title={on ? "Couper le son des notifications" : "Activer le son des notifications"}
      className="grid size-10 place-items-center rounded-full border border-gt-mist bg-white text-gt-teal-900 hover:bg-gt-teal-100"
    >
      <Icon name={on ? "volume" : "volumeOff"} className="size-[18px]" />
      <span className="sr-only">Son des notifications</span>
    </button>
  );
}
