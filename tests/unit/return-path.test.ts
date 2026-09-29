import { describe, expect, it } from "vitest";

import { safeReturnPath } from "@/lib/auth/return-path";

describe("adresse de retour après connexion (redirection ouverte)", () => {
  it("accepte un chemin interne au site de l'agence", () => {
    expect(safeReturnPath("/a/green-trek-mada/reserver/cm123abc", "green-trek-mada")).toBe(
      "/a/green-trek-mada/reserver/cm123abc",
    );
    expect(safeReturnPath("/a/green-trek-mada", "green-trek-mada")).toBe("/a/green-trek-mada");
  });

  it("refuse tout le reste", () => {
    const slug = "green-trek-mada";
    for (const retour of [
      "https://site-malveillant.test",
      "//site-malveillant.test",
      "/\\site-malveillant.test",
      "/a/demo-alpha/reserver/x", // autre agence
      "/a/green-trek-mada/../../admin",
      "/a/green-trek-mada/reserver/x?y=https://evil",
      "/dashboard",
      "javascript:alert(1)",
      "",
      null,
      undefined,
    ]) {
      expect(safeReturnPath(retour, slug), String(retour)).toBeNull();
    }
  });
});
