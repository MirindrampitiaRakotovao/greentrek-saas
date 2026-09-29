import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PHOTO_CREDITS, PHOTOS_FOURNIES } from "@/lib/photo-credits";

/** Les licences CC BY et BY-SA imposent l'attribution : aucune photo de circuit sans crédit. */
const PUBLIC = join(process.cwd(), "public");

describe("crédits photos (§8.1)", () => {
  it("chaque photo créditée ou déclarée existe dans public/", () => {
    for (const chemin of [...Object.keys(PHOTO_CREDITS), ...PHOTOS_FOURNIES.map((p) => p.chemin)]) {
      expect(existsSync(join(PUBLIC, chemin)), chemin).toBe(true);
    }
  });

  it("chaque photo de circuit livrée a un crédit complet (auteur, licence, source)", () => {
    const files = readdirSync(join(PUBLIC, "images/circuits")).filter((f) => !f.startsWith("."));
    for (const file of files) {
      const credit = PHOTO_CREDITS[`/images/circuits/${file}`];
      expect(credit, file).toBeDefined();
      expect(credit?.auteur && credit.licence && credit.source, file).toBeTruthy();
    }
  });

  it("chaque photo du dossier images est créditée ou déclarée", () => {
    const declared = new Set([
      ...Object.keys(PHOTO_CREDITS),
      ...PHOTOS_FOURNIES.map((p) => p.chemin),
    ]);
    const walk = (dir: string): string[] =>
      readdirSync(join(PUBLIC, dir), { withFileTypes: true })
        // Fichiers cachés (ex. .DS_Store de macOS) ignorés.
        .filter((entry) => !entry.name.startsWith("."))
        .flatMap((entry) =>
          entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`/${dir}/${entry.name}`],
        );
    for (const chemin of walk("images")) expect(declared.has(chemin), chemin).toBe(true);
  });
});
