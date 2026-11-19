import {
  businessError,
  json,
  preflight,
  readJson,
  UNAUTHORIZED,
  validationError,
} from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { addCommentaire } from "@/lib/services/communaute";
import { commentaireSchema } from "@/lib/validators/communaute";

/** Nouveau commentaire `{ contenu }`. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/mobile/v1/communaute/[id]/commentaires">,
) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const body = await readJson(request);
  const parsed = commentaireSchema.safeParse({
    ...(body && typeof body === "object" ? body : {}),
    publicationId: (await params).id,
  });
  if (!parsed.success) return validationError(parsed.error.issues);
  const result = await addCommentaire(ctx.user.id, parsed.data);
  if (!result.ok) return businessError(result.error, result.field);
  return json(result.data, { status: 201, private: true });
}

export const OPTIONS = preflight;
