import { z } from "zod";

import {
  businessError,
  json,
  preflight,
  readJson,
  UNAUTHORIZED,
  validationError,
} from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { setJaime } from "@/lib/services/communaute";

const bodySchema = z.object({ jaime: z.boolean() });

/** « J'aime » `{ jaime: true }` ou retrait `{ jaime: false }` ; renvoie le total. */
export async function PUT(
  request: Request,
  { params }: RouteContext<"/api/mobile/v1/communaute/[id]/jaime">,
) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error.issues);
  const result = await setJaime(ctx.user.id, (await params).id, parsed.data.jaime);
  if (!result.ok) return businessError(result.error, result.field);
  return json(result.data, { private: true });
}

export const OPTIONS = preflight;
