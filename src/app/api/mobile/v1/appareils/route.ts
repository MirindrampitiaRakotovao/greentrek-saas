import {
  businessError,
  json,
  preflight,
  readJson,
  UNAUTHORIZED,
  validationError,
} from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { registerDevice, unregisterDevice } from "@/lib/services/appareils";
import { deviceRemovalSchema, deviceSchema } from "@/lib/validators/mobile";

/** Téléphone du voyageur à prévenir par notification push `{ token, plateforme }`. */
export async function POST(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const parsed = deviceSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error.issues);
  await registerDevice(ctx.db, {
    agenceId: ctx.user.agenceId,
    utilisateurId: ctx.user.id,
    expoPushToken: parsed.data.token,
    plateforme: parsed.data.plateforme,
  });
  return json({ ok: true }, { status: 201, private: true });
}

/** Déconnexion : ce téléphone ne reçoit plus les notifications du compte `{ token }`. */
export async function DELETE(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const parsed = deviceRemovalSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error.issues);
  const result = await unregisterDevice(ctx.db, ctx.user.id, parsed.data.token);
  if (!result.ok) return businessError(result.error);
  return json({ ok: true }, { private: true });
}

export const OPTIONS = preflight;
