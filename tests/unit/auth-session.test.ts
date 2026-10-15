import { describe, expect, it } from "vitest";

import { authConfig, SHORT_SESSION_MS } from "@/auth.config";
import { loginSchema } from "@/lib/validators/auth";

/* « Se souvenir de moi » (après E12) : 30 jours si cochée, sinon 8 heures. */

type JwtParams = Parameters<typeof authConfig.callbacks.jwt>[0];
const jwt = (params: Partial<JwtParams>) =>
  authConfig.callbacks.jwt({ token: {}, ...params } as JwtParams);

const base = { userId: "u1", role: "STAFF" as const, agenceId: "a1", agenceSlug: "agence" };

describe("durée de la session", () => {
  it("à la connexion : le choix et l'heure sont enregistrés dans le jeton", async () => {
    const token = await jwt({
      user: { id: "u1", role: "STAFF", agenceId: "a1", agenceSlug: "agence", remember: true },
    });
    expect(token).toMatchObject({ userId: "u1", remember: true });
    expect(typeof token?.loginAt).toBe("number");
  });

  it("sans « Se souvenir de moi », la session se ferme après 8 heures", async () => {
    const recent = { ...base, remember: false, loginAt: Date.now() - SHORT_SESSION_MS + 60_000 };
    const ancien = { ...base, remember: false, loginAt: Date.now() - SHORT_SESSION_MS - 60_000 };
    expect(await jwt({ token: recent })).not.toBeNull();
    expect(await jwt({ token: ancien })).toBeNull();
  });

  it("avec « Se souvenir de moi », la session continue au-delà de 8 heures", async () => {
    const token = { ...base, remember: true, loginAt: Date.now() - 10 * SHORT_SESSION_MS };
    expect(await jwt({ token })).not.toBeNull();
  });

  it("la case arrive en booléen (formulaire) ou en texte (Auth.js)", () => {
    const parse = (remember: unknown) =>
      loginSchema.parse({ email: "a@b.test", password: "x", remember }).remember;
    expect(parse(true)).toBe(true);
    expect(parse("true")).toBe(true);
    expect(parse("false")).toBe(false);
    expect(parse(false)).toBe(false);
  });
});
