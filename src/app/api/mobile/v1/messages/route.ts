import { toMobileConversation } from "@/lib/mobile/activite";
import {
  businessError,
  json,
  preflight,
  readJson,
  UNAUTHORIZED,
  validationError,
} from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { listConversations, startConversation } from "@/lib/services/messagerie";
import { startConversationSchema } from "@/lib/validators/messagerie";

/** Conversations du voyageur avec son agence, la plus récemment active d'abord. */
export async function GET(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
  const viewer = { id: ctx.user.id, role: ctx.user.role };
  const result = await listConversations(ctx.db, viewer, page);
  return json(
    {
      conversations: result.items.map((c) => toMobileConversation(c, ctx.user.id)),
      page: result.page,
      pageCount: result.pageCount,
    },
    { private: true },
  );
}

/**
 * Nouveau message à l'agence `{ reservationId, sujet, contenu }` : au sujet d'une réservation
 * (une conversation par réservation, réutilisée si elle existe) ou question générale.
 */
export async function POST(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const body = await readJson(request);
  const parsed = startConversationSchema.safeParse({
    reservationId: null,
    sujet: null,
    ...(body && typeof body === "object" ? body : {}),
  });
  if (!parsed.success) return validationError(parsed.error.issues);
  const result = await startConversation(
    ctx.db,
    { id: ctx.user.id, role: ctx.user.role },
    { ...parsed.data, agenceId: ctx.user.agenceId },
  );
  if (!result.ok) return businessError(result.error, result.field);
  return json(result.data, { status: 201, private: true });
}

export const OPTIONS = preflight;
