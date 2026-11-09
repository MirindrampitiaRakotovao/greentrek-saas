import { describe, expect, it } from "vitest";

import { bearerToken, signMobileToken, verifyMobileToken } from "@/lib/mobile/token";

const SECRET = "secret-de-test-pour-les-jetons-mobiles";
const NOW = new Date("2026-11-09T09:00:00.000Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe("jeton de l'application mobile", () => {
  it("signé puis vérifié : renvoie l'identifiant de l'utilisateur", async () => {
    const token = await signMobileToken("u1", SECRET, NOW);
    expect(await verifyMobileToken(token, SECRET, days(1))).toBe("u1");
  });

  it("refusé s'il est modifié, signé avec une autre clé ou expiré (30 jours)", async () => {
    const token = await signMobileToken("u1", SECRET, NOW);
    const [header, payload, signature] = token.split(".");
    const autrePayload = Buffer.from(JSON.stringify({ sub: "admin" })).toString("base64url");
    expect(
      await verifyMobileToken(`${header}.${autrePayload}.${signature}`, SECRET, NOW),
    ).toBeNull();
    expect(await verifyMobileToken(`${header}.${payload}.${signature}x`, SECRET, NOW)).toBeNull();
    expect(await verifyMobileToken(token, "autre-secret", NOW)).toBeNull();
    expect(await verifyMobileToken(token, SECRET, days(29))).toBe("u1");
    expect(await verifyMobileToken(token, SECRET, days(31))).toBeNull();
    expect(await verifyMobileToken("n'importe quoi", SECRET, NOW)).toBeNull();
  });

  it("lit le jeton de l'en-tête « Authorization: Bearer »", () => {
    const req = (value?: string) =>
      new Request("http://localhost/api", value ? { headers: { authorization: value } } : {});
    expect(bearerToken(req("Bearer abc.def.ghi"))).toBe("abc.def.ghi");
    expect(bearerToken(req("bearer abc"))).toBe("abc");
    expect(bearerToken(req("Basic abc"))).toBeNull();
    expect(bearerToken(req())).toBeNull();
  });
});
