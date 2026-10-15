import bcrypt from "bcryptjs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { Role } from "@/generated/prisma/client";
import {
  checkResetToken,
  hashResetToken,
  RESET_MAX_PER_HOUR,
  requestPasswordReset,
  resetPassword,
} from "@/lib/services/mot-de-passe";

import { createTestClient, truncateAll } from "./test-db";

/** « Mot de passe oublié » (après E12) : portée, jeton, limites, usage unique. */
const raw = createTestClient();
const NOW = new Date("2026-10-15T09:00:00.000Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const NOUVEAU = "Nouveau2026";

afterAll(async () => {
  await raw.$disconnect();
});

let agenceA: { id: string; slug: string };
let agenceB: { id: string; slug: string };

async function user(email: string, role: Role, agenceId: string | null, actif = true) {
  return raw.utilisateur.create({
    data: {
      agenceId,
      prenom: "Hery",
      nom: "Test",
      email,
      motDePasseHash: await bcrypt.hash("Ancien2026", 4),
      role,
      actif,
    },
  });
}

async function request(email: string, agenceSlug: string | null, now = NOW) {
  return requestPasswordReset(raw, { email, agenceSlug }, now);
}

async function passwordIs(id: string, password: string) {
  const u = await raw.utilisateur.findUniqueOrThrow({ where: { id } });
  return bcrypt.compare(password, u.motDePasseHash);
}

beforeEach(async () => {
  await truncateAll(raw);
  agenceA = await raw.agence.create({ data: { nom: "Green Trek Mada", slug: "green-trek-mada" } });
  agenceB = await raw.agence.create({ data: { nom: "Tanety Trek", slug: "tanety-trek" } });
});

describe("demande d'un lien", () => {
  it("personnel : lien créé ; seule l'empreinte SHA-256 est en base, valable 1 heure", async () => {
    const staff = await user("staff@a.test", "STAFF", agenceA.id);
    const demande = await request("staff@a.test", null);
    expect(demande).toMatchObject({ to: "staff@a.test", prenom: "Hery", espace: "Green Trek" });
    const jeton = await raw.jetonReinitialisation.findFirstOrThrow({
      where: { utilisateurId: staff.id },
    });
    expect(jeton.empreinte).toBe(hashResetToken(demande!.jeton));
    expect(jeton.empreinte).not.toContain(demande!.jeton);
    expect(jeton.expireAt.getTime() - NOW.getTime()).toBe(60 * 60_000);
  });

  it("adresse inconnue : rien n'est créé (l'action répond la même chose)", async () => {
    expect(await request("inconnu@a.test", null)).toBeNull();
    expect(await raw.jetonReinitialisation.count()).toBe(0);
  });

  it("un voyageur passe par le site de son agence, le personnel par la plateforme", async () => {
    await user("client@a.test", "CLIENT", agenceA.id);
    await user("staff@a.test", "STAFF", agenceA.id);
    expect(await request("client@a.test", null)).toBeNull();
    expect(await request("staff@a.test", agenceA.slug)).toBeNull();
    expect(await request("client@a.test", agenceA.slug)).toMatchObject({
      espace: "Green Trek Mada",
    });
  });

  it("même adresse dans deux agences : seul le compte de l'agence du site est visé", async () => {
    const clientA = await user("voyageur@example.test", "CLIENT", agenceA.id);
    await user("voyageur@example.test", "CLIENT", agenceB.id);
    await request("voyageur@example.test", agenceA.slug);
    const jetons = await raw.jetonReinitialisation.findMany();
    expect(jetons.map((j) => j.utilisateurId)).toEqual([clientA.id]);
  });

  it("compte désactivé ou agence suspendue : pas de lien", async () => {
    await user("inactif@a.test", "STAFF", agenceA.id, false);
    expect(await request("inactif@a.test", null)).toBeNull();
    await user("client@b.test", "CLIENT", agenceB.id);
    await raw.agence.update({ where: { id: agenceB.id }, data: { statut: "SUSPENDUE" } });
    expect(await request("client@b.test", agenceB.slug)).toBeNull();
  });

  it(`au plus ${RESET_MAX_PER_HOUR} demandes par heure et par compte`, async () => {
    await user("staff@a.test", "STAFF", agenceA.id);
    for (let i = 0; i < RESET_MAX_PER_HOUR; i++) {
      expect(await request("staff@a.test", null, later(i))).not.toBeNull();
    }
    expect(await request("staff@a.test", null, later(10))).toBeNull();
    expect(await request("staff@a.test", null, later(61))).not.toBeNull(); // une heure après
  });
});

describe("nouveau mot de passe", () => {
  it("change le mot de passe, consomme le lien et annule les autres liens du compte", async () => {
    const staff = await user("staff@a.test", "STAFF", agenceA.id);
    const premier = await request("staff@a.test", null);
    const second = await request("staff@a.test", null, later(1));
    expect(await checkResetToken(raw, second!.jeton, null, later(2))).toEqual({ prenom: "Hery" });

    const result = await resetPassword(
      raw,
      { jeton: second!.jeton, password: NOUVEAU, agenceSlug: null },
      later(2),
    );
    expect(result.ok).toBe(true);
    expect(await passwordIs(staff.id, NOUVEAU)).toBe(true);
    // Le même lien ne resert pas, et l'autre lien est annulé.
    for (const jeton of [second!.jeton, premier!.jeton]) {
      expect(await checkResetToken(raw, jeton, null, later(3))).toBeNull();
      expect(
        (await resetPassword(raw, { jeton, password: "Autre2026x", agenceSlug: null }, later(3)))
          .ok,
      ).toBe(false);
    }
    expect(await passwordIs(staff.id, NOUVEAU)).toBe(true);
  });

  it("lien expiré après 1 heure", async () => {
    const staff = await user("staff@a.test", "STAFF", agenceA.id);
    const demande = await request("staff@a.test", null);
    const result = await resetPassword(
      raw,
      { jeton: demande!.jeton, password: NOUVEAU, agenceSlug: null },
      later(61),
    );
    expect(result.ok).toBe(false);
    expect(await passwordIs(staff.id, "Ancien2026")).toBe(true);
  });

  it("le lien d'un voyageur ne s'utilise que sur le site de son agence", async () => {
    const client = await user("client@a.test", "CLIENT", agenceA.id);
    const demande = await request("client@a.test", agenceA.slug);
    for (const slug of [null, agenceB.slug]) {
      expect(
        (await resetPassword(raw, { jeton: demande!.jeton, password: NOUVEAU, agenceSlug: slug }))
          .ok,
      ).toBe(false);
    }
    expect(
      (
        await resetPassword(raw, {
          jeton: demande!.jeton,
          password: NOUVEAU,
          agenceSlug: agenceA.slug,
        })
      ).ok,
    ).toBe(true);
    expect(await passwordIs(client.id, NOUVEAU)).toBe(true);
  });

  it("deux envois simultanés du même lien : un seul réussit", async () => {
    await user("staff@a.test", "STAFF", agenceA.id);
    const demande = await request("staff@a.test", null);
    const results = await Promise.all(
      ["Premier2026", "Second2026"].map((password) =>
        resetPassword(raw, { jeton: demande!.jeton, password, agenceSlug: null }),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("jeton inconnu ou compte désactivé entre-temps : refusé", async () => {
    const staff = await user("staff@a.test", "STAFF", agenceA.id);
    expect(await checkResetToken(raw, "x".repeat(43), null)).toBeNull();
    const demande = await request("staff@a.test", null);
    await raw.utilisateur.update({ where: { id: staff.id }, data: { actif: false } });
    expect(
      (await resetPassword(raw, { jeton: demande!.jeton, password: NOUVEAU, agenceSlug: null })).ok,
    ).toBe(false);
  });
});
