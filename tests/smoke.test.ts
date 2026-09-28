import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Test de fumée de l'étape E0 : vérifie que Vitest tourne et que les tokens de
// couleur du cahier des charges (§8.2) sont bien présents dans tokens.css.
describe("tokens de design", () => {
  const tokens = readFileSync(
    path.resolve(import.meta.dirname, "../src/styles/tokens.css"),
    "utf8",
  );

  it.each([
    ["--gt-teal-500", "#0d8495"],
    ["--gt-teal-700", "#0f6775"],
    ["--gt-sand-300", "#fad594"],
  ])("définit %s = %s", (name, value) => {
    expect(tokens).toContain(`${name}: ${value};`);
  });
});
