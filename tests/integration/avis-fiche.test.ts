import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { parseIsoDate } from "@/lib/departs";
import { createAvis, listPublicAvis, myCircuitAvis } from "@/lib/services/avis";
import { getTenantDb, type TenantDb } from "@/lib/tenant";

import { createTestClient, truncateAll } from "./test-db";

/** Note d'un circuit depuis sa fiche (étape 5b) : RG 17 conservée, un avis par séjour. */
const raw = createTestClient();

afterAll(async () => {
  await raw.$disconnect();
});

let agence: { id: string };
let db: TenantDb;
let circuitId: string;
let client: string;
let autre: string;

async function sejour(
  clientId: string,
  statut: "TERMINEE" | "CONFIRMEE",
  debut: string,
  ref: string,
) {
  const dateDebut = parseIsoDate(debut);
  const session = await raw.sessionDepart.create({
    data: { agenceId: agence.id, circuitId, dateDebut, dateFin: dateDebut, placesTotal: 8 },
  });
  return raw.reservation.create({
    data: {
      agenceId: agence.id,
      reference: ref,
      clientId,
      sessionId: session.id,
      nombrePersonnes: 1,
      montantTotal: 100_000,
      statut,
    },
  });
}

beforeEach(async () => {
  await truncateAll(raw);
  agence = await raw.agence.create({ data: { nom: "A", slug: "a" } });
  db = getTenantDb(agence.id, raw);
  circuitId = (
    await raw.circuit.create({
      data: {
        agenceId: agence.id,
        titre: "Sentier",
        slug: "sentier",
        difficulte: "FACILE",
        dureeJours: 1,
        prixParPersonne: 100_000,
        capaciteMax: 8,
        statut: "PUBLIE",
      },
    })
  ).id;
  const mk = async (email: string) =>
    (
      await raw.utilisateur.create({
        data: {
          agenceId: agence.id,
          email,
          prenom: "Lova",
          nom: "Rabe",
          motDePasseHash: "x",
          role: "CLIENT",
          photoUrl: "/fichiers/avatars/0f8fad5b-d9cb-469f-a165-70867728950e.webp",
        },
      })
    ).id;
  client = await mk("lova@example.com");
  autre = await mk("autre@example.com");
});

describe("noter depuis la fiche du circuit", () => {
  it("sans séjour terminé : rien à noter (RG 17)", async () => {
    await sejour(client, "CONFIRMEE", "2026-12-20", "R-1");
    expect(await myCircuitAvis(db, client, circuitId)).toEqual({
      reservationId: null,
      sejour: null,
      dernierAvis: null,
    });
  });

  it("séjour terminé : à noter une fois ; ensuite l'avis s'affiche en attente", async () => {
    const r = await sejour(client, "TERMINEE", "2026-10-01", "R-2");
    expect((await myCircuitAvis(db, client, circuitId)).reservationId).toBe(r.id);
    // Un autre voyageur n'a rien à noter.
    expect((await myCircuitAvis(db, autre, circuitId)).reservationId).toBeNull();

    await createAvis(db, {
      agenceId: agence.id,
      reservationId: r.id,
      clientId: client,
      note: 5,
      commentaire: "Superbe.",
    });
    const apres = await myCircuitAvis(db, client, circuitId);
    expect(apres.reservationId).toBeNull();
    expect(apres.dernierAvis).toMatchObject({ note: 5, statut: "EN_ATTENTE" });
  });

  it("deux séjours terminés : le plus récent sans avis reste à noter", async () => {
    const ancien = await sejour(client, "TERMINEE", "2026-08-01", "R-3");
    await createAvis(db, {
      agenceId: agence.id,
      reservationId: ancien.id,
      clientId: client,
      note: 4,
      commentaire: null,
    });
    const recent = await sejour(client, "TERMINEE", "2026-10-15", "R-4");
    expect((await myCircuitAvis(db, client, circuitId)).reservationId).toBe(recent.id);
  });

  it("avis publiés : la photo de l'auteur accompagne son prénom", async () => {
    const r = await sejour(client, "TERMINEE", "2026-10-01", "R-5");
    await createAvis(db, {
      agenceId: agence.id,
      reservationId: r.id,
      clientId: client,
      note: 5,
      commentaire: "Superbe.",
    });
    await raw.avis.updateMany({ data: { statut: "PUBLIE" } });
    const [a] = await listPublicAvis(db, { circuitId });
    expect(a).toMatchObject({
      auteur: "Lova R.",
      photo: "/fichiers/avatars/0f8fad5b-d9cb-469f-a165-70867728950e.webp",
    });
  });
});
