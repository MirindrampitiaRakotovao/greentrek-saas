import { describe, expect, it } from "vitest";

import {
  DEMO_ALPHA_CIRCUITS,
  DEMO_ALPHA_GRAPH,
  DEMO_BETA_CIRCUITS,
  DEMO_BETA_GRAPH,
  type DemoGraph,
  generateAgencyDemo,
  generateDemoEdges,
  GREEN_TREK_CIRCUITS,
  GREEN_TREK_GRAPH,
  ISLANDS,
} from "../../prisma/demo-data";
import { estimateDistanceKm } from "@/lib/graph/estimation";
import { COTE_EST_OSM_PLACES, MAHAMBO_OSM_PLACES } from "../../prisma/osm-mahambo";

/**
 * Les données de démonstration doivent respecter les règles de gestion : sinon, les
 * tableaux de bord afficheraient des situations impossibles (surbooking, montants faux…).
 */
const NOW = new Date("2026-09-28T09:00:00Z");
const specs = [
  { prefix: "GT", circuits: GREEN_TREK_CIRCUITS, clientCount: 9, seed: 1 },
  { prefix: "ALP", circuits: DEMO_ALPHA_CIRCUITS, clientCount: 9, seed: 2 },
  { prefix: "BET", circuits: DEMO_BETA_CIRCUITS, clientCount: 9, seed: 3 },
];
const all = specs.map((spec) => generateAgencyDemo(spec, NOW));

describe("données de démonstration", () => {
  it("volumes du §11 : une dizaine de circuits, ≥ 20 départs, ≥ 50 réservations", () => {
    expect(all.reduce((n, d) => n + d.circuits.length, 0)).toBe(10);
    expect(all.reduce((n, d) => n + d.sessions.length, 0)).toBeGreaterThanOrEqual(20);
    expect(all.reduce((n, d) => n + d.reservations.length, 0)).toBeGreaterThanOrEqual(50);
  });

  it("est déterministe (même graine, même date → mêmes données)", () => {
    expect(generateAgencyDemo(specs[0]!, NOW)).toEqual(all[0]);
  });

  it("les circuits de Green Trek sont marqués [DÉMO] et TODO(données terrain)", () => {
    for (const circuit of GREEN_TREK_CIRCUITS) {
      expect(circuit.titre.startsWith("[DÉMO]")).toBe(true);
      expect(circuit.description).toContain("TODO(données terrain)");
    }
  });

  for (const [index, data] of all.entries()) {
    const label = specs[index]!.prefix;

    it(`${label} — RG 10 : date de fin ≥ date de début`, () => {
      for (const s of data.sessions)
        expect(s.dateFin.getTime()).toBeGreaterThanOrEqual(s.dateDebut.getTime());
    });

    it(`${label} — RG 13 : jamais plus de personnes que de places ; RG 11 : COMPLETE si plein`, () => {
      data.sessions.forEach((session, sessionIndex) => {
        const booked = data.reservations
          .filter((r) => r.sessionIndex === sessionIndex && r.statut !== "ANNULEE")
          .reduce((n, r) => n + r.nombrePersonnes, 0);
        expect(booked).toBeLessThanOrEqual(session.placesTotal);
        if (session.statut === "COMPLETE") expect(booked).toBe(session.placesTotal);
        if (session.statut === "OUVERTE") expect(booked).toBeLessThan(session.placesTotal);
      });
    });

    it(`${label} — RG 14 : montant = prix du départ (ou du circuit) × personnes`, () => {
      for (const r of data.reservations) {
        const session = data.sessions[r.sessionIndex]!;
        const prix =
          session.prixParPersonne ?? data.circuits[session.circuitIndex]!.prixParPersonne;
        expect(r.montantTotal).toBe(prix * r.nombrePersonnes);
      }
    });

    it(`${label} — RG 16 : paiements validés ≤ montant total`, () => {
      for (const r of data.reservations) {
        const valides = r.paiements
          .filter((p) => p.statut === "VALIDE")
          .reduce((n, p) => n + p.montant, 0);
        expect(valides).toBeLessThanOrEqual(r.montantTotal);
      }
    });

    it(`${label} — cohérence : participants, dates, statuts, références uniques`, () => {
      const references = new Set<string>();
      for (const r of data.reservations) {
        const session = data.sessions[r.sessionIndex]!;
        expect(r.participants).toHaveLength(r.nombrePersonnes);
        expect(r.createdAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
        // Aucun événement dans le futur (sinon : paiements « encaissés » demain).
        for (const date of [r.confirmeeAt, r.annuleeAt, ...r.paiements.map((p) => p.payeLe)]) {
          if (date) expect(date.getTime()).toBeLessThanOrEqual(NOW.getTime());
        }
        expect(r.createdAt.getTime()).toBeLessThan(session.dateDebut.getTime());
        expect(session.statut).not.toBe("ANNULEE"); // pas de réservation sur un départ annulé
        if (r.statut === "TERMINEE") expect(session.statut).toBe("TERMINEE");
        expect(references.has(r.reference)).toBe(false);
        references.add(r.reference);
      }
    });
  }

  it("prévoit des réservations créées ce mois-ci et le mois précédent (tableau de bord lisible)", () => {
    const reservations = all.flatMap((d) => d.reservations);
    const thisMonth = reservations.filter((r) => r.createdAt >= new Date("2026-09-01T00:00:00Z"));
    const lastMonth = reservations.filter(
      (r) =>
        r.createdAt >= new Date("2026-08-01T00:00:00Z") &&
        r.createdAt < new Date("2026-09-01T00:00:00Z"),
    );
    expect(thisMonth.length).toBeGreaterThan(0);
    expect(lastMonth.length).toBeGreaterThan(0);
  });

  describe("graphes de démonstration (étapes et itinéraires)", () => {
    const graphs = [
      ["GT", GREEN_TREK_GRAPH, GREEN_TREK_CIRCUITS],
      ["ALP", DEMO_ALPHA_GRAPH, DEMO_ALPHA_CIRCUITS],
      ["BET", DEMO_BETA_GRAPH, DEMO_BETA_CIRCUITS],
    ] as const;

    for (const [label, graph, circuits] of graphs) {
      it(`${label} — un itinéraire par circuit, au moins 2 étapes (RG 4), index valides`, () => {
        expect(graph.itineraires).toHaveLength(circuits.length);
        for (const itineraire of graph.itineraires) {
          expect(itineraire.length).toBeGreaterThanOrEqual(2);
          itineraire.forEach((index, position) => {
            expect(graph.etapes[index]).toBeDefined();
            if (position > 0) expect(index).not.toBe(itineraire[position - 1]);
          });
        }
      });

      it(`${label} — coordonnées valides`, () => {
        for (const e of graph.etapes) {
          expect(Math.abs(e.latitude)).toBeLessThanOrEqual(90);
          expect(Math.abs(e.longitude)).toBeLessThanOrEqual(180);
        }
      });
    }

    it("Green Trek : uniquement des lieux OpenStreetMap, source citée, aucune coordonnée inventée", () => {
      // Tous dans la bande côtière Est de Madagascar (Analanjirofo, Atsinanana, Sainte-Marie).
      for (const e of GREEN_TREK_GRAPH.etapes) {
        expect(e.latitude).toBeGreaterThan(-18.2);
        expect(e.latitude).toBeLessThan(-16.8);
        expect(e.longitude).toBeGreaterThan(49.1);
        expect(e.longitude).toBeLessThan(49.9);
      }
      expect(GREEN_TREK_GRAPH.etapes.map((e) => [e.nom, e.latitude, e.longitude])).toEqual(
        [...MAHAMBO_OSM_PLACES, ...COTE_EST_OSM_PLACES].map((p) => [
          p.nom,
          p.latitude,
          p.longitude,
        ]),
      );
      for (const e of GREEN_TREK_GRAPH.etapes) expect(e.description).toContain("OpenStreetMap");
      // Ambodiforaha n'existe pas dans OpenStreetMap : il ne doit pas être créé.
      expect(GREEN_TREK_GRAPH.etapes.some((e) => e.nom.includes("Ambodiforaha"))).toBe(false);
    });

    it("agences fictives : toutes les étapes sont marquées (fictif)", () => {
      for (const e of [...DEMO_ALPHA_GRAPH.etapes, ...DEMO_BETA_GRAPH.etapes]) {
        expect(e.nom).toContain("(fictif)");
      }
    });
  });

  describe("tronçons de démonstration (étape E5)", () => {
    /** Composantes connexes du graphe (listes de noms). */
    function components(graph: DemoGraph) {
      const edges = generateDemoEdges(graph);
      const parent = graph.etapes.map((_, i) => i);
      const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
      for (const e of edges) parent[find(e.from)] = find(e.to);
      const groups = new Map<number, string[]>();
      graph.etapes.forEach((e, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), e.nom]));
      return [...groups.values()];
    }

    for (const [label, graph] of [
      ["GT", GREEN_TREK_GRAPH],
      ["ALP", DEMO_ALPHA_GRAPH],
      ["BET", DEMO_BETA_GRAPH],
    ] as const) {
      it(`${label} — arêtes valides : pas de boucle, une seule par paire, distance estimée`, () => {
        const edges = generateDemoEdges(graph);
        const keys = new Set<string>();
        for (const e of edges) {
          expect(e.from).not.toBe(e.to);
          expect(graph.etapes[e.from]).toBeDefined();
          expect(graph.etapes[e.to]).toBeDefined();
          const key = `${Math.min(e.from, e.to)}-${Math.max(e.from, e.to)}`;
          expect(keys.has(key)).toBe(false);
          keys.add(key);
          expect(e.distanceKm).toBe(estimateDistanceKm(graph.etapes[e.from]!, graph.etapes[e.to]!));
          expect(e.dureeMinutes).toBeGreaterThan(0);
        }
      });

      it(`${label} — chaque itinéraire suit des tronçons existants`, () => {
        const keys = new Set(
          generateDemoEdges(graph).map(
            (e) => `${Math.min(e.from, e.to)}-${Math.max(e.from, e.to)}`,
          ),
        );
        for (const itineraire of graph.itineraires) {
          for (let p = 1; p < itineraire.length; p += 1) {
            const [x, y] = [itineraire[p - 1]!, itineraire[p]!];
            expect(keys.has(`${Math.min(x, y)}-${Math.max(x, y)}`)).toBe(true);
          }
        }
      });
    }

    it("Green Trek : continent connexe ; Sainte-Marie séparée (pas de tronçon à pied par la mer)", () => {
      const groups = components(GREEN_TREK_GRAPH);
      expect(groups).toHaveLength(2);
      expect(groups.find((g) => g.length === ISLANDS.size)?.sort()).toEqual([...ISLANDS].sort());
    });

    it("agences fictives : graphe connexe", () => {
      expect(components(DEMO_ALPHA_GRAPH)).toHaveLength(1);
      expect(components(DEMO_BETA_GRAPH)).toHaveLength(1);
    });
  });
});
