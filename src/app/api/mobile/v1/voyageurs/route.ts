import { json, preflight, UNAUTHORIZED } from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { listBlocked, listVoyageurs } from "@/lib/services/voyageurs";

/**
 * Voyageurs de l'agence qui acceptent les messages (étape 5c) : prénom, initiale, photo et
 * présence ; `?q=` filtre par nom. Avec la liste des voyageurs que j'ai bloqués.
 */
export async function GET(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim().slice(0, 100) || undefined;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [list, bloques] = await Promise.all([
    listVoyageurs(ctx.db, ctx.user.id, q, page),
    listBlocked(ctx.db, ctx.user.id),
  ]);
  return json(
    {
      voyageurs: list.items.map((v) => ({ id: v.id, nom: v.nom, photo: v.photo, ...v.presence })),
      page: list.page,
      pageCount: list.pageCount,
      bloques,
    },
    { private: true },
  );
}

export const OPTIONS = preflight;
