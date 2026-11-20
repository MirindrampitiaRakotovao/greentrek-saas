import { toMobilePublication } from "@/lib/mobile/communaute";
import { businessError, json, jsonError, preflight, UNAUTHORIZED } from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { createPublication, listFeed } from "@/lib/services/communaute";
import { deleteImage, fileToBuffer, saveImage, UploadError } from "@/lib/uploads";
import { feedFiltersSchema, PHOTOS_MAX, publicationSchema } from "@/lib/validators/communaute";

/**
 * Fil de la communauté (toutes les agences) : `?page=`, `tri=recentes|populaires`, `q=`,
 * `circuit=<id>` (destination), `moi=1` (mes publications).
 */
export async function GET(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Math.min(500, Number(params.get("page")) || 1));
  // Mêmes filtres que le site : tri, recherche, destination, mes publications.
  const filters = feedFiltersSchema.parse({
    tri: params.get("tri") ?? undefined,
    q: params.get("q") ?? undefined,
    circuit: params.get("circuit") ?? undefined,
    moi: params.get("moi") ?? undefined,
  });
  const feed = await listFeed(ctx.user.id, page, undefined, filters);
  return json(
    {
      publications: feed.items.map(toMobilePublication),
      page: feed.page,
      pageCount: feed.pageCount,
    },
    { private: true },
  );
}

/**
 * Nouvelle publication (multipart : `reservationId`, `legende`, `photos` ×1 à 8), pour un
 * séjour terminé du voyageur. Photos vérifiées, réduites, sans métadonnées ni position GPS.
 */
export async function POST(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("Formulaire invalide.", 400);
  const parsed = publicationSchema.safeParse({
    reservationId: form.get("reservationId"),
    legende: form.get("legende") || null,
  });
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Données invalides.", 400);
  const files = form.getAll("photos");
  if (files.length === 0) return jsonError("Ajoutez au moins une photo.", 422);
  if (files.length > PHOTOS_MAX) return jsonError(`${PHOTOS_MAX} photos au maximum.`, 422);

  const saved: string[] = [];
  try {
    for (const file of files) saved.push(await saveImage(await fileToBuffer(file), "publications"));
  } catch (error: unknown) {
    await Promise.all(saved.map((url) => deleteImage(url)));
    if (error instanceof UploadError) return jsonError(error.message, 422);
    throw error;
  }
  const result = await createPublication(ctx.user.id, { ...parsed.data, photos: saved });
  if (!result.ok) {
    await Promise.all(saved.map((url) => deleteImage(url)));
    return businessError(result.error, result.field);
  }
  return json(result.data, { status: 201, private: true });
}

export const OPTIONS = preflight;
