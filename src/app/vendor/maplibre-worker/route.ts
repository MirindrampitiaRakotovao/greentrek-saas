import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Script « worker » de MapLibre (carte 3D, étape 6a), servi depuis le paquet installé : la
 * version servie est toujours celle de `package.json`, sans fichier copié dans `public/`.
 * MapLibre le cherche à côté de son module, ce que l'empaquetage de Next.js ne permet pas ;
 * la carte lui donne donc cette adresse (`setWorkerUrl`).
 */
let cache: string | null = null;

export async function GET() {
  cache ??= await readFile(
    join(process.cwd(), "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"),
    "utf8",
  );
  return new Response(cache, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
