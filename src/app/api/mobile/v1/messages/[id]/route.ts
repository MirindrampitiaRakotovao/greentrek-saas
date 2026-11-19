import { toMobileThread } from "@/lib/mobile/activite";
import {
  businessError,
  json,
  jsonError,
  preflight,
  readJson,
  UNAUTHORIZED,
  validationError,
} from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { presenceOfGroup } from "@/lib/presence";
import {
  getConversation,
  isBlockedBetween,
  markConversationRead,
  sendMessage,
} from "@/lib/services/messagerie";
import { messageSchema } from "@/lib/validators/messagerie";

/** Fil d'une conversation du voyageur ; l'ouvrir la marque comme lue. */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/mobile/v1/messages/[id]">,
) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const { id } = await params;
  const viewer = { id: ctx.user.id, role: ctx.user.role };
  const thread = await getConversation(ctx.db, viewer, id);
  if (!thread) return jsonError("Conversation introuvable.", 404);
  await markConversationRead(ctx.db, viewer, id);
  const autre =
    thread.type === "VOYAGEURS"
      ? thread.client.id === ctx.user.id
        ? thread.destinataire
        : thread.client
      : null;
  const [agence, equipe, bloque] = await Promise.all([
    ctx.db.agence.findFirstOrThrow({ select: { logoUrl: true } }),
    autre
      ? Promise.resolve([])
      : ctx.db.utilisateur.findMany({
          where: { actif: true, role: { in: ["ADMIN_AGENCE", "STAFF"] } },
          select: { derniereActiviteAt: true, presenceVisible: true },
        }),
    autre ? isBlockedBetween(ctx.db, ctx.user.id, autre.id) : Promise.resolve(false),
  ]);
  return json(
    toMobileThread(thread, ctx.user.id, agence.logoUrl, {
      presenceAgence: presenceOfGroup(equipe),
      bloque,
    }),
    { private: true },
  );
}

/** Réponse dans la conversation `{ contenu }`. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/mobile/v1/messages/[id]">,
) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const { id } = await params;
  const body = await readJson(request);
  const parsed = messageSchema.safeParse({
    ...(body && typeof body === "object" ? body : {}),
    conversationId: id,
  });
  if (!parsed.success) return validationError(parsed.error.issues);
  const result = await sendMessage(ctx.db, { id: ctx.user.id, role: ctx.user.role }, parsed.data);
  if (!result.ok) return businessError(result.error, result.field);
  return json(result.data, { status: 201, private: true });
}

export const OPTIONS = preflight;
