import { isUploadKind, isUploadName } from "@/lib/upload-paths";
import { readImage } from "@/lib/uploads";

/**
 * Images envoyées (photos de profil, logos, publications) : servies telles qu'enregistrées
 * (déjà nettoyées). Nom aléatoire et contenu jamais modifié : cache d'un an. Tout autre
 * chemin : 404 (aucune lecture hors du dossier des envois).
 */
export async function GET(_request: Request, { params }: RouteContext<"/fichiers/[kind]/[name]">) {
  const { kind, name } = await params;
  if (!isUploadKind(kind) || !isUploadName(name)) return new Response(null, { status: 404 });
  const data = await readImage(kind, name);
  if (!data) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
