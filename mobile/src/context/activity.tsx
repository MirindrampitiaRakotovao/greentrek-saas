import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";

import { useAuth } from "@/context/auth";
import { fetchActivity, registerDevice, type Unread } from "@/lib/api";
import {
  enableNotifications,
  type NotificationTarget,
  pushToken,
  ring,
  setRegisteredPushToken,
  targetOf,
} from "@/lib/notifications";

/** Intervalle d'interrogation du site, application ouverte. */
export const POLL_MS = 20_000;

const NONE: Unread = { notifications: 0, conversations: 0 };

type ActivityState = {
  unread: Unread;
  /** Relit les compteurs tout de suite (après lecture d'un message, par exemple). */
  refresh: () => void;
  /** Jeton push du téléphone (niveau 2), ou `null` (niveau 1 seulement). */
  deviceToken: string | null;
};

const ActivityContext = createContext<ActivityState | null>(null);

function open(target: NotificationTarget) {
  if (target.type === "reservation") {
    router.push({ pathname: "/reservation/[id]", params: { id: target.reservationId } });
  } else if (target.type === "itineraire") {
    router.push({ pathname: "/itineraires/[id]", params: { id: target.itineraireId } });
  } else if (target.type === "message") {
    router.push({ pathname: "/messages/[id]", params: { id: target.conversationId } });
  } else router.push("/notifications");
}

/**
 * Nouveautés du voyageur connecté : pastilles (notifications, messages non lus) et sonnerie.
 * - Application ouverte : interrogation toutes les 20 s ; chaque nouveauté fait sonner le
 *   téléphone (notification locale), sauf si le push est actif (il sonne déjà : pas de doublon).
 * - Connexion : autorisation demandée, puis le téléphone est enregistré pour le push si
 *   l'application installée le permet.
 * - Notification touchée : ouverture de la réservation ou de la conversation concernée.
 */
export function ActivityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Compte connecté : l'état ci-dessous n'est valable que pour lui (changement de compte = zéro).
  const account = user ? `${user.agenceSlug}/${user.email}` : null;
  const [counts, setCounts] = useState<{ account: string; unread: Unread } | null>(null);
  const [device, setDevice] = useState<{ account: string; token: string } | null>(null);
  const [tick, setTick] = useState(0);
  const since = useRef<{ account: string; at: string } | null>(null);

  const unread = counts && counts.account === account ? counts.unread : NONE;
  const deviceToken = device && device.account === account ? device.token : null;

  const poll = useEffectEvent(async () => {
    if (!account) return;
    try {
      const previous = since.current?.account === account ? since.current.at : null;
      const a = await fetchActivity(previous);
      since.current = { account, at: a.serveur };
      setCounts({ account, unread: a.nonLues });
      // Premier passage : seulement les compteurs (pas d'alerte pour l'historique). Push actif :
      // le téléphone a déjà sonné, pas de doublon.
      if (previous === null || deviceToken) return;
      for (const n of a.notifications) {
        await ring(
          n.titre,
          n.message,
          n.reservationId
            ? { type: "reservation", reservationId: n.reservationId }
            : n.itineraireId
              ? { type: "itineraire", itineraireId: n.itineraireId }
              : { type: "notifications" },
        );
      }
      for (const m of a.messages) {
        await ring(`Nouveau message de ${m.auteur}`, m.sujet, {
          type: "message",
          conversationId: m.conversationId,
        });
      }
    } catch {
      // Hors connexion : nouvel essai au passage suivant.
    }
  });

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Relecture demandée par un écran (message lu, notification ouverte).
  useEffect(() => {
    if (tick > 0) void poll();
  }, [tick]);

  // Interrogation régulière, seulement application au premier plan et voyageur connecté.
  useEffect(() => {
    if (!account) return;
    void poll();
    let timer = setInterval(() => void poll(), POLL_MS);
    const sub = AppState.addEventListener("change", (state) => {
      clearInterval(timer);
      if (state === "active") {
        void poll();
        timer = setInterval(() => void poll(), POLL_MS);
      }
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [account]);

  // Autorisation et enregistrement du téléphone pour le push, à la connexion.
  useEffect(() => {
    if (!account) return;
    let active = true;
    void (async () => {
      if (!(await enableNotifications())) return;
      const token = await pushToken();
      if (!token || !active) return;
      try {
        await registerDevice(token, Platform.OS === "ios" ? "ios" : "android");
        setRegisteredPushToken(token);
        if (active) setDevice({ account, token });
      } catch {
        // Serveur injoignable : le niveau 1 (application ouverte) reste actif.
      }
    })();
    return () => {
      active = false;
    };
  }, [account]);

  // Notification touchée (application ouverte, en arrière-plan, ou lancée par la notification).
  useEffect(() => {
    if (Platform.OS === "web" || !account) return;
    const initial = targetOf(
      Notifications.getLastNotificationResponse()?.notification.request.content.data,
    );
    if (initial) {
      Notifications.clearLastNotificationResponse();
      open(initial);
    }
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const target = targetOf(response.notification.request.content.data);
      if (target) open(target);
    });
    return () => sub.remove();
  }, [account]);

  return <ActivityContext value={{ unread, refresh, deviceToken }}>{children}</ActivityContext>;
}

export function useActivity(): ActivityState {
  const ctx = use(ActivityContext);
  if (!ctx) throw new Error("useActivity : ActivityProvider manquant.");
  return ctx;
}
