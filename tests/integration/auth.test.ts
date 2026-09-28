import bcrypt from "bcryptjs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { Role } from "@/generated/prisma/client";
import { authenticate, isStaffEmailTaken, loadActiveUser } from "@/lib/auth/authenticate";
import { registerAgency, TRIAL_DAYS } from "@/lib/services/onboarding";

import { createTestClient, truncateAll } from "./test-db";

/**
 * Authentification et onboarding (étape E2b). Toutes les personnes sont fictives.
 * bcrypt avec un coût de 4 pour accélérer les tests (10 en application).
 */
const db = createTestClient();
const PASSWORD = "Motdepasse1";
const hash = bcrypt.hashSync(PASSWORD, 4);

afterAll(async () => {
  await db.$disconnect();
});

async function createAgence(slug: string, statut: "ACTIVE" | "SUSPENDUE" = "ACTIVE") {
  return db.agence.create({ data: { nom: `Agence ${slug}`, slug, statut } });
}

async function createUser(agenceId: string | null, role: Role, email: string, actif = true) {
  return db.utilisateur.create({
    data: { agenceId, role, email, actif, nom: "Test", prenom: role, motDePasseHash: hash },
  });
}

beforeEach(async () => {
  await truncateAll(db);
});

describe("authenticate : connexion du personnel (/connexion)", () => {
  it("accepte le bon mot de passe et renvoie rôle et agence", async () => {
    const agence = await createAgence("agence-a");
    const admin = await createUser(agence.id, "ADMIN_AGENCE", "admin@a.test");

    const user = await authenticate({ email: "admin@a.test", password: PASSWORD }, db);

    expect(user).toMatchObject({
      id: admin.id,
      role: "ADMIN_AGENCE",
      agenceId: agence.id,
      agenceSlug: "agence-a",
    });
  });

  it("met à jour la date de dernière connexion", async () => {
    const agence = await createAgence("agence-a");
    const staff = await createUser(agence.id, "STAFF", "staff@a.test");
    await authenticate({ email: "staff@a.test", password: PASSWORD }, db);
    const updated = await db.utilisateur.findUniqueOrThrow({ where: { id: staff.id } });
    expect(updated.dernierLoginAt).not.toBeNull();
  });

  it("refuse un mauvais mot de passe", async () => {
    const agence = await createAgence("agence-a");
    await createUser(agence.id, "ADMIN_AGENCE", "admin@a.test");
    await expect(
      authenticate({ email: "admin@a.test", password: "Mauvais123" }, db),
    ).resolves.toBeNull();
  });

  it("refuse un e-mail inconnu", async () => {
    await expect(
      authenticate({ email: "inconnu@a.test", password: PASSWORD }, db),
    ).resolves.toBeNull();
  });

  it("accepte le super admin, sans agence", async () => {
    await createUser(null, "SUPER_ADMIN", "super@plateforme.test");
    const user = await authenticate({ email: "super@plateforme.test", password: PASSWORD }, db);
    expect(user).toMatchObject({ role: "SUPER_ADMIN", agenceId: null, agenceSlug: null });
  });

  it("refuse un client, même avec le bon mot de passe", async () => {
    const agence = await createAgence("agence-a");
    await createUser(agence.id, "CLIENT", "client@a.test");
    await expect(
      authenticate({ email: "client@a.test", password: PASSWORD }, db),
    ).resolves.toBeNull();
  });

  it("RG 19 : refuse un compte désactivé", async () => {
    const agence = await createAgence("agence-a");
    await createUser(agence.id, "STAFF", "staff@a.test", false);
    await expect(
      authenticate({ email: "staff@a.test", password: PASSWORD }, db),
    ).resolves.toBeNull();
  });

  it("RG 19 : refuse le personnel d'une agence suspendue", async () => {
    const agence = await createAgence("agence-a", "SUSPENDUE");
    await createUser(agence.id, "ADMIN_AGENCE", "admin@a.test");
    await expect(
      authenticate({ email: "admin@a.test", password: PASSWORD }, db),
    ).resolves.toBeNull();
  });
});

describe("authenticate : connexion client (/a/[slug]/connexion)", () => {
  it("accepte un client sur le site de son agence", async () => {
    const agence = await createAgence("agence-a");
    const client = await createUser(agence.id, "CLIENT", "client@exemple.test");
    const user = await authenticate(
      { email: "client@exemple.test", password: PASSWORD, agenceSlug: "agence-a" },
      db,
    );
    expect(user).toMatchObject({ id: client.id, role: "CLIENT", agenceSlug: "agence-a" });
  });

  it("refuse un client de A sur le site de B", async () => {
    const a = await createAgence("agence-a");
    await createAgence("agence-b");
    await createUser(a.id, "CLIENT", "client@exemple.test");
    await expect(
      authenticate(
        { email: "client@exemple.test", password: PASSWORD, agenceSlug: "agence-b" },
        db,
      ),
    ).resolves.toBeNull();
  });

  it("distingue deux comptes clients au même e-mail dans deux agences (RG 3)", async () => {
    const a = await createAgence("agence-a");
    const b = await createAgence("agence-b");
    await createUser(a.id, "CLIENT", "client@exemple.test");
    const clientB = await createUser(b.id, "CLIENT", "client@exemple.test");
    const user = await authenticate(
      { email: "client@exemple.test", password: PASSWORD, agenceSlug: "agence-b" },
      db,
    );
    expect(user?.id).toBe(clientB.id);
  });

  it("refuse le personnel sur la page de connexion client", async () => {
    const agence = await createAgence("agence-a");
    await createUser(agence.id, "ADMIN_AGENCE", "admin@a.test");
    await expect(
      authenticate({ email: "admin@a.test", password: PASSWORD, agenceSlug: "agence-a" }, db),
    ).resolves.toBeNull();
  });

  it("RG 19 : refuse un client d'une agence suspendue", async () => {
    const agence = await createAgence("agence-a", "SUSPENDUE");
    await createUser(agence.id, "CLIENT", "client@exemple.test");
    await expect(
      authenticate(
        { email: "client@exemple.test", password: PASSWORD, agenceSlug: "agence-a" },
        db,
      ),
    ).resolves.toBeNull();
  });
});

describe("loadActiveUser : relecture à chaque requête protégée (RG 19)", () => {
  it("renvoie l'utilisateur tant que le compte et l'agence sont actifs", async () => {
    const agence = await createAgence("agence-a");
    const staff = await createUser(agence.id, "STAFF", "staff@a.test");
    await expect(loadActiveUser(staff.id, db)).resolves.toMatchObject({ id: staff.id });
  });

  it("coupe l'accès dès que l'agence est suspendue, même avec une session en cours", async () => {
    const agence = await createAgence("agence-a");
    const staff = await createUser(agence.id, "STAFF", "staff@a.test");
    await db.agence.update({ where: { id: agence.id }, data: { statut: "SUSPENDUE" } });
    await expect(loadActiveUser(staff.id, db)).resolves.toBeNull();
  });

  it("coupe l'accès dès que le compte est désactivé", async () => {
    const agence = await createAgence("agence-a");
    const staff = await createUser(agence.id, "STAFF", "staff@a.test");
    await db.utilisateur.update({ where: { id: staff.id }, data: { actif: false } });
    await expect(loadActiveUser(staff.id, db)).resolves.toBeNull();
  });

  it("renvoie null pour un identifiant inconnu", async () => {
    await expect(loadActiveUser("inexistant", db)).resolves.toBeNull();
  });
});

describe("isStaffEmailTaken", () => {
  it("détecte l'e-mail d'un membre du personnel de n'importe quelle agence", async () => {
    const agence = await createAgence("agence-a");
    await createUser(agence.id, "GUIDE", "guide@a.test");
    await expect(isStaffEmailTaken("  GUIDE@a.test ", db)).resolves.toBe(true);
  });

  it("ignore les comptes clients", async () => {
    const agence = await createAgence("agence-a");
    await createUser(agence.id, "CLIENT", "client@exemple.test");
    await expect(isStaffEmailTaken("client@exemple.test", db)).resolves.toBe(false);
  });
});

describe("registerAgency : onboarding (§7.5)", () => {
  const input = {
    nomAgence: "Nouvelle Agence",
    slug: "nouvelle-agence",
    prenom: "Jean",
    nom: "Test",
    email: "jean@nouvelle.test",
    password: PASSWORD,
    confirmPassword: PASSWORD,
  };

  async function createTrialPlan() {
    return db.plan.create({
      data: {
        code: "ESSAI",
        nom: "Essai",
        prixMensuel: 0,
        maxCircuits: 3,
        maxUtilisateurs: 3,
        maxSessionsActives: 5,
        fonctionnalites: [],
      },
    });
  }

  it("crée l'agence, l'administrateur et l'abonnement d'essai", async () => {
    const plan = await createTrialPlan();
    const result = await registerAgency(input, db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const admin = await db.utilisateur.findFirstOrThrow({ where: { agenceId: result.agenceId } });
    expect(admin).toMatchObject({ role: "ADMIN_AGENCE", email: input.email });
    expect(await bcrypt.compare(PASSWORD, admin.motDePasseHash)).toBe(true);

    const abonnement = await db.abonnement.findFirstOrThrow({
      where: { agenceId: result.agenceId },
    });
    expect(abonnement).toMatchObject({ planId: plan.id, statut: "ESSAI" });
    const days = (abonnement.dateFin!.getTime() - abonnement.dateDebut.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(TRIAL_DAYS);

    // Le nouvel administrateur peut se connecter immédiatement.
    await expect(
      authenticate({ email: input.email, password: PASSWORD }, db),
    ).resolves.toMatchObject({ role: "ADMIN_AGENCE", agenceSlug: input.slug });
  });

  it("RG 1 : refuse un slug déjà pris, sans rien créer", async () => {
    await createTrialPlan();
    await createAgence("nouvelle-agence");
    const result = await registerAgency(input, db);
    expect(result).toMatchObject({ ok: false, field: "slug" });
    await expect(db.utilisateur.count()).resolves.toBe(0);
  });

  it("refuse l'e-mail d'un membre du personnel d'une autre agence", async () => {
    await createTrialPlan();
    const autre = await createAgence("autre-agence");
    await createUser(autre.id, "STAFF", input.email);
    const result = await registerAgency(input, db);
    expect(result).toMatchObject({ ok: false, field: "email" });
    await expect(db.agence.count()).resolves.toBe(1);
  });

  it("accepte l'e-mail d'un client d'une autre agence (espaces distincts)", async () => {
    await createTrialPlan();
    const autre = await createAgence("autre-agence");
    await createUser(autre.id, "CLIENT", input.email);
    await expect(registerAgency(input, db)).resolves.toMatchObject({ ok: true });
  });

  it("échoue proprement si le plan d'essai n'existe pas", async () => {
    await expect(registerAgency(input, db)).resolves.toMatchObject({ ok: false, field: "form" });
    await expect(db.agence.count()).resolves.toBe(0);
  });
});
