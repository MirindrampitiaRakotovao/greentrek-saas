import { describe, expect, it } from "vitest";

import { isAppPath, resolveTheme, THEME_SCRIPT, THEME_STORAGE_KEY } from "@/lib/theme";

/** Mode sombre (étape 7) : seulement dans les espaces connectés, thème du système par défaut. */
describe("thème clair / sombre", () => {
  it("espaces connectés seulement : back-office, console, espace voyageur", () => {
    for (const path of [
      "/dashboard",
      "/dashboard/reservations/abc",
      "/admin",
      "/admin/agences",
      "/a/green-trek-mada/mon-compte",
      "/a/green-trek-mada/mon-compte/communaute",
    ]) {
      expect(isAppPath(path), path).toBe(true);
    }
    for (const path of [
      "/",
      "/tarifs",
      "/connexion",
      "/a/green-trek-mada",
      "/a/green-trek-mada/circuits/x",
      "/a/green-trek-mada/connexion",
      "/a/green-trek-mada/facture/abc",
      "/dashboards",
    ]) {
      expect(isAppPath(path), path).toBe(false);
    }
  });

  it("« Système » suit le thème du système ; « Clair » et « Sombre » s'imposent", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("le script du <head> est autonome et se lit sans erreur", () => {
    expect(THEME_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
    expect(THEME_SCRIPT).toContain('"(prefers-color-scheme: dark)"');
    // Syntaxe JavaScript valide (il n'est pas exécuté ici).
    expect(() => new Function(THEME_SCRIPT)).not.toThrow();
  });
});
