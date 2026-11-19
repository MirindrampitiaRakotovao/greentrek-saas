import type { AlertEvent } from "@/lib/realtime/events";

/**
 * Notifications push de l'application mobile, par le service d'Expo (après E12, hors cahier
 * des charges : service tiers, documenté dans AVANCEMENT). Le téléphone sonne même quand
 * l'application est fermée. Le contenu reste court et sans donnée sensible (ni montant, ni
 * numéro de paiement, ni texte d'un message privé) : il s'affiche sur l'écran verrouillé.
 * Fonctions pures, sauf `sendExpoPush` (réseau, client HTTP injectable pour les tests).
 */

export const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** Le service accepte au plus 100 messages par requête. */
export const EXPO_PUSH_BATCH = 100;
/** Canal Android créé par l'application (importance maximale : son et bandeau). */
export const ANDROID_CHANNEL = "alertes";

export type PushData =
  | { type: "reservation"; reservationId: string }
  | { type: "itineraire"; itineraireId: string }
  | { type: "message"; conversationId: string }
  | { type: "notifications" };

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data: PushData;
  sound: "default";
  priority: "high";
  channelId: string;
};

const TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/;

/** Jeton au format Expo (`ExponentPushToken[…]`) : le reste est refusé à l'enregistrement. */
export function isExpoPushToken(value: string): boolean {
  return TOKEN.test(value);
}

/** Réservation visée par le lien d'une notification (`…/mon-compte/reservations/<id>`). */
export function reservationIdFromLink(lienUrl: string | null): string | null {
  return lienUrl?.match(/\/mon-compte\/reservations\/([A-Za-z0-9_-]+)$/)?.[1] ?? null;
}

/** Itinéraire sur mesure visé par le lien d'une notification (`…/mon-compte/itineraires/<id>`). */
export function itineraireIdFromLink(lienUrl: string | null): string | null {
  return lienUrl?.match(/\/mon-compte\/itineraires\/([A-Za-z0-9_-]+)$/)?.[1] ?? null;
}

/** Titre, texte et destination d'un événement temps réel, pour un téléphone. */
export function pushContent(event: AlertEvent): { title: string; body: string; data: PushData } {
  if (event.type === "message") {
    return {
      title: `Nouveau message de ${event.auteur}`,
      body: event.sujet,
      data: { type: "message", conversationId: event.conversationId },
    };
  }
  const reservationId = reservationIdFromLink(event.lienUrl);
  const itineraireId = itineraireIdFromLink(event.lienUrl);
  return {
    title: event.titre,
    body: event.message,
    data: reservationId
      ? { type: "reservation", reservationId }
      : itineraireId
        ? { type: "itineraire", itineraireId }
        : { type: "notifications" },
  };
}

/** Un message par téléphone, par paquets de 100 (limite du service). */
export function buildPushBatches(
  tokens: readonly string[],
  event: AlertEvent,
): ExpoPushMessage[][] {
  const content = pushContent(event);
  const messages = [...new Set(tokens)].map((to) => ({
    to,
    ...content,
    sound: "default" as const,
    priority: "high" as const,
    channelId: ANDROID_CHANNEL,
  }));
  const batches: ExpoPushMessage[][] = [];
  for (let i = 0; i < messages.length; i += EXPO_PUSH_BATCH) {
    batches.push(messages.slice(i, i + EXPO_PUSH_BATCH));
  }
  return batches;
}

type Ticket = { status: "ok" | "error"; details?: { error?: string } };

/**
 * Jetons à oublier d'après la réponse du service : `DeviceNotRegistered` signifie que
 * l'application a été désinstallée (ou ses notifications coupées) sur ce téléphone.
 */
export function unregisteredTokens(batch: readonly ExpoPushMessage[], tickets: unknown): string[] {
  if (!Array.isArray(tickets)) return [];
  return batch
    .filter((m, i) => {
      const t = tickets[i] as Ticket | undefined;
      return t?.status === "error" && t.details?.error === "DeviceNotRegistered";
    })
    .map((m) => m.to);
}

export type PushTransport = (url: string, init: RequestInit) => Promise<Response>;

/** Envoie les paquets ; renvoie les jetons à oublier. Une erreur réseau n'est pas bloquante. */
export async function sendExpoPush(
  batches: readonly ExpoPushMessage[][],
  transport: PushTransport = fetch,
): Promise<string[]> {
  const stale: string[] = [];
  for (const batch of batches) {
    try {
      const res = await transport(EXPO_PUSH_URL, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { data?: unknown };
      stale.push(...unregisteredTokens(batch, body.data));
    } catch {
      // Service injoignable (démonstration hors ligne) : la notification reste dans l'application.
    }
  }
  return stale;
}
