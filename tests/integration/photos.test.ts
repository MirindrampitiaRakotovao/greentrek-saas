import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { mobileProfile } from "@/lib/mobile/session";
import { setAgencyLogo, setUserPhoto } from "@/lib/services/photos";
import { getTenantDb } from "@/lib/tenant";

import { createTestClient, truncateAll } from "./test-db";

/** Photo de profil et logo (après E12) : adresse enregistrée, ancienne renvoyée, isolation. */
const raw = createTestClient();

afterAll(async () => {
  await raw.$disconnect();
});

let agenceA: { id: string };
let agenceB: { id: string };
let userA: string;
let userB: string;
const PHOTO = "/fichiers/avatars/0f8fad5b-d9cb-469f-a165-70867728950e.webp";
const LOGO = "/fichiers/logos/7c9e6679-7425-40de-944b-e07fc1f90ae7.webp";

beforeEach(async () => {
  await truncateAll(raw);
  agenceA = await raw.agence.create({ data: { nom: "A", slug: "a", logoUrl: "/logo/a.png" } });
  agenceB = await raw.agence.create({ data: { nom: "B", slug: "b" } });
  const mk = async (agenceId: string, email: string) =>
    (
      await raw.utilisateur.create({
        data: { agenceId, email, prenom: "Hery", nom: "Test", motDePasseHash: "x", role: "CLIENT" },
      })
    ).id;
  userA = await mk(agenceA.id, "a@example.com");
  userB = await mk(agenceB.id, "b@example.com");
});

describe("photo de profil et logo", () => {
  it("enregistre la photo, renvoie l'ancienne ; visible dans le profil mobile", async () => {
    const db = getTenantDb(agenceA.id, raw);
    expect(await setUserPhoto(db, userA, PHOTO)).toBeNull();
    expect(await setUserPhoto(db, userA, null)).toBe(PHOTO);
    await setUserPhoto(db, userA, PHOTO);
    expect(await mobileProfile(userA, raw)).toMatchObject({
      photoUrl: PHOTO,
      agenceLogoUrl: "/logo/a.png",
    });
  });

  it("une agence ne change ni la photo d'un compte d'une autre agence, ni son logo", async () => {
    const dbA = getTenantDb(agenceA.id, raw);
    expect(await setUserPhoto(dbA, userB, PHOTO)).toBeNull();
    expect((await raw.utilisateur.findUniqueOrThrow({ where: { id: userB } })).photoUrl).toBeNull();
    expect(await setAgencyLogo(dbA, agenceB.id, LOGO)).toBeNull();
    expect((await raw.agence.findUniqueOrThrow({ where: { id: agenceB.id } })).logoUrl).toBeNull();
    expect(await setAgencyLogo(dbA, agenceA.id, LOGO)).toBe("/logo/a.png");
  });
});
