import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { isUploadName, parseUploadUrl, uploadUrl } from "@/lib/upload-paths";

vi.mock("server-only", () => ({}));

/*
 * Images envoyées (après E12) : photos de profil, logos, publications. Vérification du
 * fichier, nettoyage des métadonnées (position GPS), réduction, noms sûrs.
 */

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "gt-uploads-"));
  process.env.UPLOAD_DIR = dir;
});
afterAll(async () => {
  delete process.env.UPLOAD_DIR;
  await rm(dir, { recursive: true, force: true });
});

/** Photo JPEG 2000 × 1500 avec une position GPS dans ses métadonnées EXIF. */
async function photoWithGps(): Promise<Buffer> {
  return sharp({ create: { width: 2000, height: 1500, channels: 3, background: "#0f6775" } })
    .jpeg()
    .withExif({
      IFD0: { Make: "Téléphone", Model: "Test" },
      IFD3: {
        GPSLatitudeRef: "S",
        GPSLatitude: "17/1 29/1 0/1",
        GPSLongitudeRef: "E",
        GPSLongitude: "49/1 27/1 0/1",
      },
    })
    .toBuffer();
}

describe("chemins des fichiers envoyés", () => {
  it("n'accepte que /fichiers/<dossier connu>/<uuid>.webp", () => {
    const name = "0f8fad5b-d9cb-469f-a165-70867728950e.webp";
    expect(isUploadName(name)).toBe(true);
    expect(parseUploadUrl(uploadUrl("avatars", name))).toEqual({ kind: "avatars", name });
    for (const bad of [
      "/fichiers/avatars/../../.env",
      "/fichiers/secrets/0f8fad5b-d9cb-469f-a165-70867728950e.webp",
      "/fichiers/avatars/photo.png",
      "/logo/green-trek.png",
      "https://exemple.test/a.webp",
      null,
    ]) {
      expect(parseUploadUrl(bad)).toBeNull();
    }
  });
});

describe("enregistrement d'une image", () => {
  it("photo de profil : WebP 512 × 512, SANS les métadonnées (position GPS)", async () => {
    const { saveImage } = await import("@/lib/uploads");
    const input = await photoWithGps();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const url = await saveImage(input, "avatars");
    const parsed = parseUploadUrl(url)!;
    expect(parsed.kind).toBe("avatars");
    const meta = await sharp(join(dir, "avatars", parsed.name)).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 512, height: 512 });
    expect(meta.exif).toBeUndefined();
  });

  it("refuse un faux fichier image et un fichier trop lourd", async () => {
    const { saveImage, UploadError, MAX_UPLOAD_BYTES } = await import("@/lib/uploads");
    await expect(saveImage(Buffer.from("<script>alert(1)</script>"), "avatars")).rejects.toThrow(
      UploadError,
    );
    await expect(saveImage(Buffer.alloc(MAX_UPLOAD_BYTES + 1), "avatars")).rejects.toThrow(
      "Image trop lourde (5 Mo au plus).",
    );
  });

  it("logo : proportions gardées ; suppression limitée aux fichiers envoyés", async () => {
    const { deleteImage, saveImage } = await import("@/lib/uploads");
    const wide = await sharp({
      create: { width: 1200, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const url = await saveImage(wide, "logos");
    const parsed = parseUploadUrl(url)!;
    const meta = await sharp(join(dir, "logos", parsed.name)).metadata();
    expect(meta).toMatchObject({ width: 512, height: 171, hasAlpha: true });

    await deleteImage("/logo/green-trek.png"); // fichier livré : jamais supprimé
    await deleteImage(url);
    expect(await readdir(join(dir, "logos"))).toEqual([]);
  });
});
