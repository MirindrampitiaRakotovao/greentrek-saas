import bcrypt from "bcryptjs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { Role } from "@/generated/prisma/client";
import { authenticate } from "@/lib/auth/authenticate";
import {
  changePassword,
  createMember,
  getTeamMember,
  listTeam,
  setMemberActive,
  updateMember,
  updateProfile,
} from "@/lib/services/team";
import { getTenantDb, type TenantDb } from "@/lib/tenant";

import { createTestClient, truncateAll } from "./test-db";

/** Gestion de l'équipe et profil (étape E3a). Personnes fictives, bcrypt au coût 4. */
const raw = createTestClient();
const PASSWORD = "Motdepasse1";
const hash = bcrypt.hashSync(PASSWORD, 4);

afterAll(async () => {
  await raw.$disconnect();
});

let agenceA: { id: string };
let agenceB: { id: string };
let dbA: TenantDb;
let adminA: { id: string };

async function createUser(agenceId: string, role: Role, email: string, actif = true) {
  return raw.utilisateur.create({
    data: { agenceId, role, email, actif, nom: "Test", prenom: role, motDePasseHash: hash },
  });
}

const newMember = {
  prenom: "Nouveau",
  nom: "Membre",
  email: "nouveau@a.test",
  telephone: null,
  role: "STAFF" as const,
  password: PASSWORD,
};

beforeEach(async () => {
  await truncateAll(raw);
  agenceA = await raw.agence.create({ data: { nom: "Agence A", slug: "agence-a" } });
  agenceB = await raw.agence.create({ data: { nom: "Agence B", slug: "agence-b" } });
  adminA = await createUser(agenceA.id, "ADMIN_AGENCE", "admin@a.test");
  dbA = getTenantDb(agenceA.id, raw);
});

describe("createMember", () => {
  it("crée un compte STAFF dans l'agence, avec un mot de passe haché", async () => {
    const result = await createMember(dbA, agenceA.id, newMember, raw);
    expect(result.ok).toBe(true);
    const created = await raw.utilisateur.findFirstOrThrow({ where: { email: newMember.email } });
    expect(created).toMatchObject({ agenceId: agenceA.id, role: "STAFF", actif: true });
    expect(created.motDePasseHash).not.toBe(PASSWORD);
    await expect(
      authenticate({ email: newMember.email, password: PASSWORD }, raw),
    ).resolves.toMatchObject({ role: "STAFF" });
  });

  it("un compte GUIDE reçoit automatiquement sa fiche Guide reliée", async () => {
    const result = await createMember(dbA, agenceA.id, { ...newMember, role: "GUIDE" }, raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const fiche = await raw.guide.findFirstOrThrow({ where: { utilisateurId: result.data.id } });
    expect(fiche).toMatchObject({ agenceId: agenceA.id, prenom: "Nouveau", nom: "Membre" });
  });

  it("refuse l'e-mail d'un membre du personnel d'une autre agence", async () => {
    await createUser(agenceB.id, "STAFF", newMember.email);
    await expect(createMember(dbA, agenceA.id, newMember, raw)).resolves.toMatchObject({
      ok: false,
      field: "email",
    });
  });

  it("refuse l'e-mail d'un client de la même agence (index unique)", async () => {
    await createUser(agenceA.id, "CLIENT", newMember.email);
    await expect(createMember(dbA, agenceA.id, newMember, raw)).resolves.toMatchObject({
      ok: false,
      field: "email",
    });
  });
});

describe("listTeam et getTeamMember", () => {
  it("liste le personnel de l'agence, sans les clients ni les autres agences", async () => {
    await createUser(agenceA.id, "CLIENT", "client@a.test");
    await createUser(agenceB.id, "STAFF", "staff@b.test");
    await createUser(agenceA.id, "GUIDE", "guide@a.test");
    const team = await listTeam(dbA, 1);
    expect(team.total).toBe(2);
    expect(team.items.map((m) => m.role).sort()).toEqual(["ADMIN_AGENCE", "GUIDE"]);
  });

  it("un membre d'une autre agence est introuvable", async () => {
    const staffB = await createUser(agenceB.id, "STAFF", "staff@b.test");
    await expect(getTeamMember(dbA, staffB.id)).resolves.toBeNull();
    await expect(setMemberActive(dbA, adminA.id, staffB.id, false)).resolves.toMatchObject({
      ok: false,
    });
    const unchanged = await raw.utilisateur.findUniqueOrThrow({ where: { id: staffB.id } });
    expect(unchanged.actif).toBe(true);
  });

  it("un client n'est pas modifiable par la gestion d'équipe", async () => {
    const client = await createUser(agenceA.id, "CLIENT", "client@a.test");
    await expect(
      updateMember(dbA, agenceA.id, adminA.id, {
        id: client.id,
        prenom: "X",
        nom: "Y",
        telephone: null,
        role: "ADMIN_AGENCE",
      }),
    ).resolves.toMatchObject({ ok: false });
  });
});

describe("updateMember : rôles", () => {
  const edit = (id: string, role: "ADMIN_AGENCE" | "STAFF" | "GUIDE") => ({
    id,
    prenom: "Prénom",
    nom: "Nom",
    telephone: null,
    role,
  });

  it("modifie l'identité et le rôle d'un membre", async () => {
    const staff = await createUser(agenceA.id, "STAFF", "staff@a.test");
    await expect(
      updateMember(dbA, agenceA.id, adminA.id, edit(staff.id, "ADMIN_AGENCE")),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      raw.utilisateur.findUniqueOrThrow({ where: { id: staff.id } }),
    ).resolves.toMatchObject({ role: "ADMIN_AGENCE", prenom: "Prénom" });
  });

  it("refuse de changer son propre rôle", async () => {
    await createUser(agenceA.id, "ADMIN_AGENCE", "admin2@a.test");
    await expect(
      updateMember(dbA, agenceA.id, adminA.id, edit(adminA.id, "STAFF")),
    ).resolves.toMatchObject({ ok: false, field: "role" });
  });

  it("refuse de rétrograder le dernier administrateur actif", async () => {
    const otherAdmin = await createUser(agenceA.id, "ADMIN_AGENCE", "admin2@a.test");
    await raw.utilisateur.update({ where: { id: adminA.id }, data: { actif: false } });
    await expect(
      updateMember(dbA, agenceA.id, adminA.id, edit(otherAdmin.id, "STAFF")),
    ).resolves.toMatchObject({ ok: false, field: "role" });
  });

  it("passer en GUIDE crée la fiche ; quitter GUIDE la détache sans la supprimer", async () => {
    const staff = await createUser(agenceA.id, "STAFF", "staff@a.test");
    await updateMember(dbA, agenceA.id, adminA.id, edit(staff.id, "GUIDE"));
    const fiche = await raw.guide.findFirstOrThrow({ where: { utilisateurId: staff.id } });

    await updateMember(dbA, agenceA.id, adminA.id, edit(staff.id, "STAFF"));
    const detached = await raw.guide.findUniqueOrThrow({ where: { id: fiche.id } });
    expect(detached.utilisateurId).toBeNull();
  });
});

describe("setMemberActive", () => {
  it("désactive puis réactive un membre ; il perd puis retrouve l'accès", async () => {
    const staff = await createUser(agenceA.id, "STAFF", "staff@a.test");
    await expect(setMemberActive(dbA, adminA.id, staff.id, false)).resolves.toMatchObject({
      ok: true,
    });
    await expect(
      authenticate({ email: "staff@a.test", password: PASSWORD }, raw),
    ).resolves.toBeNull();
    await setMemberActive(dbA, adminA.id, staff.id, true);
    await expect(
      authenticate({ email: "staff@a.test", password: PASSWORD }, raw),
    ).resolves.not.toBeNull();
  });

  it("refuse de se désactiver soi-même", async () => {
    await createUser(agenceA.id, "ADMIN_AGENCE", "admin2@a.test");
    await expect(setMemberActive(dbA, adminA.id, adminA.id, false)).resolves.toMatchObject({
      ok: false,
    });
  });

  it("refuse de désactiver le dernier administrateur actif", async () => {
    const staffActor = await createUser(agenceA.id, "STAFF", "staff@a.test");
    await expect(setMemberActive(dbA, staffActor.id, adminA.id, false)).resolves.toMatchObject({
      ok: false,
    });
  });

  it("autorise à désactiver un administrateur s'il en reste un autre actif", async () => {
    const otherAdmin = await createUser(agenceA.id, "ADMIN_AGENCE", "admin2@a.test");
    await expect(setMemberActive(dbA, adminA.id, otherAdmin.id, false)).resolves.toMatchObject({
      ok: true,
    });
  });
});

describe("profil", () => {
  it("met à jour son identité", async () => {
    await updateProfile(dbA, adminA.id, { prenom: "Rado", nom: "Test", telephone: "+261 34 00" });
    await expect(
      raw.utilisateur.findUniqueOrThrow({ where: { id: adminA.id } }),
    ).resolves.toMatchObject({ prenom: "Rado", telephone: "+261 34 00" });
  });

  it("ne peut pas modifier le profil d'un utilisateur d'une autre agence", async () => {
    const staffB = await createUser(agenceB.id, "STAFF", "staff@b.test");
    await expect(
      updateProfile(dbA, staffB.id, { prenom: "Pirate", nom: "X", telephone: null }),
    ).resolves.toMatchObject({ ok: false });
  });

  it("refuse le changement de mot de passe si l'ancien est faux", async () => {
    await expect(
      changePassword(dbA, adminA.id, {
        currentPassword: "Mauvais123",
        newPassword: "Nouveau123",
        confirmPassword: "Nouveau123",
      }),
    ).resolves.toMatchObject({ ok: false, field: "currentPassword" });
  });

  it("change le mot de passe : l'ancien ne fonctionne plus, le nouveau oui", async () => {
    await changePassword(dbA, adminA.id, {
      currentPassword: PASSWORD,
      newPassword: "Nouveau123",
      confirmPassword: "Nouveau123",
    });
    await expect(
      authenticate({ email: "admin@a.test", password: PASSWORD }, raw),
    ).resolves.toBeNull();
    await expect(
      authenticate({ email: "admin@a.test", password: "Nouveau123" }, raw),
    ).resolves.not.toBeNull();
  });
});
