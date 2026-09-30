import bcrypt from "bcryptjs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { authenticate, loadActiveUser } from "@/lib/auth/authenticate";
import { parseIsoDate } from "@/lib/departs";
import { findVitrineAgency } from "@/lib/public-agency";
import { getCurrentSubscription, getUsage } from "@/lib/services/abonnements";
import { createCircuit, setCircuitStatut } from "@/lib/services/circuits";
import { createDepart } from "@/lib/services/departs";
import {
  assignPlan,
  createPlan,
  getAgence,
  listAgences,
  setAgenceStatut,
  setPlanActif,
  subscriptionEnd,
  updatePlan,
} from "@/lib/services/plateforme";
import { createMember, setMemberActive } from "@/lib/services/team";
import { getTenantDb, type TenantDb } from "@/lib/tenant";
import type { CircuitInput } from "@/lib/validators/circuits";
import { planSchema } from "@/lib/validators/plateforme";

import { createTestClient, truncateAll } from "./test-db";

/** Plans, abonnements simulés, limites (RG 18) et suspension (RG 19) : étape E11. */
const raw = createTestClient();
const NOW = new Date("2026-09-30T09:00:00.000Z");

afterAll(async () => {
  await raw.$disconnect();
});

let agence: { id: string; slug: string };
let db: TenantDb;
let essai: { id: string };
let pro: { id: string };
let adminId: string;

const circuit = (slug: string): CircuitInput => ({
  titre: `Circuit ${slug}`,
  slug,
  resume: null,
  description: null,
  difficulte: "FACILE",
  dureeJours: 1,
  prixParPersonne: 100_000,
  capaciteMax: 10,
  imagePrincipaleUrl: null,
});

function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

async function subscribe(planId: string, statut: "ESSAI" | "ACTIF", dateFin: string | null) {
  await raw.abonnement.create({
    data: {
      agenceId: agence.id,
      planId,
      statut,
      dateDebut: parseIsoDate("2026-09-01"),
      dateFin: dateFin ? parseIsoDate(dateFin) : null,
    },
  });
}

beforeEach(async () => {
  await truncateAll(raw);
  agence = await raw.agence.create({ data: { nom: "Agence A", slug: "agence-a" } });
  db = getTenantDb(agence.id, raw);
  essai = await raw.plan.create({
    data: {
      code: "ESSAI",
      nom: "Essai",
      prixMensuel: 0,
      maxCircuits: 2,
      maxUtilisateurs: 2,
      maxSessionsActives: 2,
      fonctionnalites: [],
    },
  });
  pro = await raw.plan.create({
    data: {
      code: "PRO",
      nom: "Pro",
      prixMensuel: 150_000,
      maxCircuits: 20,
      maxUtilisateurs: 10,
      maxSessionsActives: 50,
      fonctionnalites: ["Tableau de bord"],
    },
  });
  adminId = (
    await raw.utilisateur.create({
      data: {
        agenceId: agence.id,
        nom: "Admin",
        prenom: "A",
        email: "admin@a.test",
        motDePasseHash: await bcrypt.hash("Motdepasse1", 4),
        role: "ADMIN_AGENCE",
      },
    })
  ).id;
});

describe("limites du plan (RG 18)", () => {
  it("circuits : refus au-delà de la limite ; un circuit archivé ne compte pas", async () => {
    await subscribe(essai.id, "ESSAI", "2026-10-30");
    const c1 = unwrap(await createCircuit(db, agence.id, circuit("c1")));
    unwrap(await createCircuit(db, agence.id, circuit("c2")));
    const refus = await createCircuit(db, agence.id, circuit("c3"));
    expect(refus.ok ? "" : refus.error).toContain("Limite du plan Essai atteinte : 2 circuits");
    // Archiver libère une place ; le sortir des archives à la limite est refusé.
    unwrap(await setCircuitStatut(db, c1.id, "ARCHIVE"));
    unwrap(await createCircuit(db, agence.id, circuit("c3")));
    expect((await setCircuitStatut(db, c1.id, "BROUILLON")).ok).toBe(false);
  });

  it("comptes du personnel : création et réactivation comptées ; les clients ne comptent pas", async () => {
    await subscribe(essai.id, "ESSAI", "2026-10-30");
    await raw.utilisateur.create({
      data: {
        agenceId: agence.id,
        nom: "Client",
        prenom: "C",
        email: "client@a.test",
        motDePasseHash: "x",
        role: "CLIENT",
      },
    });
    const member = (email: string) =>
      createMember(
        db,
        agence.id,
        {
          prenom: "S",
          nom: "Staff",
          email,
          telephone: null,
          role: "STAFF",
          password: "Motdepasse1",
        },
        raw,
      );
    const staff = unwrap(await member("s1@a.test")); // admin + 1 = 2 comptes
    expect((await member("s2@a.test")).ok).toBe(false);
    unwrap(await setMemberActive(db, adminId, staff.id, false));
    unwrap(await member("s2@a.test"));
    expect((await setMemberActive(db, adminId, staff.id, true)).ok).toBe(false);
    expect((await getUsage(db, NOW)).utilisateurs).toBe(2);
  });

  it("départs actifs : refus au-delà ; un départ annulé ne compte pas", async () => {
    await subscribe(essai.id, "ACTIF", null);
    const c = unwrap(await createCircuit(db, agence.id, circuit("c1")));
    const depart = (debut: string) =>
      createDepart(
        db,
        agence.id,
        {
          circuitId: c.id,
          dateDebut: debut,
          dateFin: debut,
          placesTotal: 5,
          prixParPersonne: null,
          guideId: null,
          notes: null,
        },
        NOW,
      );
    const d1 = unwrap(await depart("2026-10-10"));
    unwrap(await depart("2026-10-11"));
    expect((await depart("2026-10-12")).ok).toBe(false);
    await raw.sessionDepart.update({ where: { id: d1.id }, data: { statut: "ANNULEE" } });
    expect((await depart("2026-10-12")).ok).toBe(true);
  });

  it("décision B : essai expiré → créations bloquées ; statut EXPIRE enregistré", async () => {
    await subscribe(essai.id, "ESSAI", "2026-09-29");
    const refus = await createCircuit(db, agence.id, circuit("c1"));
    expect(refus.ok ? "" : refus.error).toContain("expiré");
    expect((await getCurrentSubscription(db, NOW))?.statut).toBe("EXPIRE");
    expect((await raw.abonnement.findFirstOrThrow()).statut).toBe("EXPIRE");
  });

  it("décision C : agence sans abonnement → pas de limite", async () => {
    for (const slug of ["c1", "c2", "c3", "c4"]) {
      unwrap(await createCircuit(db, agence.id, circuit(slug)));
    }
  });
});

describe("attribution d'un plan par le super admin", () => {
  it("clôture l'abonnement en cours, en crée un nouveau ; nouvelles limites immédiates", async () => {
    await subscribe(essai.id, "ESSAI", "2026-10-30");
    unwrap(await createCircuit(db, agence.id, circuit("c1")));
    unwrap(await createCircuit(db, agence.id, circuit("c2")));
    expect((await createCircuit(db, agence.id, circuit("c3"))).ok).toBe(false);

    unwrap(
      await assignPlan(
        { agenceId: agence.id, planId: pro.id, duree: "12", statut: "ACTIF" },
        NOW,
        raw,
      ),
    );
    const abonnements = await raw.abonnement.findMany({ orderBy: { dateDebut: "asc" } });
    expect(abonnements.map((a) => a.statut)).toEqual(["ANNULE", "ACTIF"]);
    expect(abonnements[1]?.dateFin?.toISOString().slice(0, 10)).toBe("2027-09-29");
    expect((await getCurrentSubscription(db, NOW))?.plan.nom).toBe("Pro");
    unwrap(await createCircuit(db, agence.id, circuit("c3")));
  });

  it("refuse un plan désactivé", async () => {
    unwrap(await setPlanActif(pro.id, false, raw));
    const result = await assignPlan(
      { agenceId: agence.id, planId: pro.id, duree: "illimitee", statut: "ACTIF" },
      NOW,
      raw,
    );
    expect(result).toMatchObject({ ok: false, field: "planId" });
  });

  it("date de fin : durée en mois, dernier jour inclus", () => {
    const fin = (debut: string, mois: number) =>
      subscriptionEnd(parseIsoDate(debut), mois).toISOString().slice(0, 10);
    expect(fin("2026-09-30", 1)).toBe("2026-10-29");
    expect(fin("2026-01-15", 12)).toBe("2027-01-14");
  });
});

describe("suspension d'une agence (RG 19)", () => {
  it("connexion refusée, session en cours invalidée, site vitrine introuvable ; réactivation", async () => {
    const login = () => authenticate({ email: "admin@a.test", password: "Motdepasse1" }, raw);
    expect(await login()).not.toBeNull();
    unwrap(await setAgenceStatut(agence.id, "SUSPENDUE", raw));
    expect(await login()).toBeNull();
    expect(await loadActiveUser(adminId, raw)).toBeNull();
    expect(await findVitrineAgency(raw, agence.slug)).toBeNull();
    unwrap(await setAgenceStatut(agence.id, "ACTIVE", raw));
    expect(await login()).not.toBeNull();
    expect(await findVitrineAgency(raw, agence.slug)).not.toBeNull();
  });
});

describe("supervision et plans", () => {
  it("liste des agences avec plan courant et compteurs (personnel sans les clients)", async () => {
    await subscribe(pro.id, "ACTIF", null);
    await raw.agence.create({ data: { nom: "Agence B", slug: "agence-b", statut: "SUSPENDUE" } });
    const list = await listAgences(undefined, 1, NOW, raw);
    expect(list.total).toBe(2);
    const a = list.items.find((x) => x.slug === "agence-a");
    expect(a).toMatchObject({ abonnement: { plan: "Pro", statut: "ACTIF" } });
    expect(a?._count.utilisateurs).toBe(1);
    expect((await listAgences("agence-b", 1, NOW, raw)).items[0]?.statut).toBe("SUSPENDUE");
    const detail = await getAgence(agence.id, NOW, raw);
    expect(detail?.subscription?.plan.nom).toBe("Pro");
    expect(detail?.usage).toEqual({ circuits: 0, utilisateurs: 1, departs: 0 });
  });

  it("plans : code unique, fonctionnalités une par ligne", async () => {
    const input = planSchema.parse({
      code: "premium",
      nom: "Premium",
      prixMensuel: "250000",
      maxCircuits: "50",
      maxUtilisateurs: "20",
      maxSessionsActives: "100",
      fonctionnalites: "Site vitrine\n\n  Export CSV  \n",
    });
    expect(input).toMatchObject({
      code: "PREMIUM",
      fonctionnalites: ["Site vitrine", "Export CSV"],
    });
    unwrap(await createPlan(input, raw));
    expect(await createPlan(input, raw)).toMatchObject({ ok: false, field: "code" });
    expect(await updatePlan(pro.id, input, raw)).toMatchObject({ ok: false, field: "code" });
  });
});
