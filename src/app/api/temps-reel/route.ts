import { getCurrentUser } from "@/lib/auth/session";
import { subscribe } from "@/lib/realtime/bus";
import type { RealtimeEvent } from "@/lib/realtime/events";
import { touchPresence } from "@/lib/services/voyageurs";
import { getTenantDb } from "@/lib/tenant";

/**
 * Canal temps réel (Server-Sent Events) : notifications et messages de l'utilisateur
 * connecté, poussés par le serveur dès leur enregistrement (après E12).
 *
 * - La session est relue en base à l'ouverture : sans session, 401. Chaque onglet ne reçoit
 *   que les événements de SON utilisateur (abonnement par identifiant).
 * - Sens unique serveur → navigateur ; les envois passent par les actions serveur habituelles.
 * - Un commentaire est envoyé toutes les 25 s pour garder la connexion ouverte ; le
 *   navigateur (`EventSource`) se reconnecte seul après une coupure (`retry`).
 */
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Session expirée.", { status: 401 });

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup(); // flux déjà fermé
        }
      };
      const send = (event: RealtimeEvent) =>
        write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);

      const unsubscribe = subscribe(user.id, send);
      // Présence « en ligne » (étape 5c) : tant que l'onglet est ouvert, la dernière activité
      // est rafraîchie (au plus une écriture par minute, voir `touchPresence`).
      const presence = () => {
        if (user.agenceId) void touchPresence(getTenantDb(user.agenceId), user.id).catch(() => {});
      };
      presence();
      const heartbeat = setInterval(() => {
        write(": ping\n\n");
        presence();
      }, HEARTBEAT_MS);
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        cleanup = () => {};
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // déjà fermé
        }
      });

      write("retry: 5000\n: connecté\n\n");
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
