import { describe, expect, it } from "vitest";

import {
  type DemoGraph,
  exampleEmail,
  generateAgencyDemo,
  generateClients,
  generateDemoEdges,
  GREEN_TREK_CIRCUITS,
  GREEN_TREK_GRAPH,
  ISLANDS,
  RANOHIRA_CIRCUITS,
  RANOHIRA_GRAPH,
  TANETY_CIRCUITS,
  TANETY_GRAPH,
} from "../../prisma/demo-data";
import { estimateDistanceKm } from "@/lib/graph/estimation";
import { COTE_EST_OSM_PLACES, MAHAMBO_OSM_PLACES } from "../../prisma/osm-mahambo";

/**
 * Les données de démonstration doivent respecter les règles de gestion : sinon, les
 * tableaux de bord afficheraient des situations impossibles (surbooking, montants faux…).
 */
const NOW = new Date("2026-09-28T09:00:00Z");
const specs = [
  { prefix: "GT", circuits: GREEN_TREK_CIRCUITS, clients: generateClients(40, 1), seed: 1 },
  { prefix: "TT", circuits: TANETY_CIRCUITS, clients: generateClients(20, 2), seed: 2 },
  { prefix: "RS", circuits: RANOHIRA_CIRCUITS, clients: generateClients(20, 3), seed: 3 },
];
const all = specs.map((spec) => generateAgencyDemo(spec, NOW));

describe("données de démonstration", () => {
  it("volumes : une dizaine de circuits, 12 mois d'historique, au moins 200 réservations", () => {
    expect(all.reduce((n, d) => n + d.circuits.length, 0)).toBe(10);
    expect(all.reduce((n, d) => n + d.sessions.length, 0)).toBeGreaterThanOrEqual(80);
    expect(all.reduce((n, d) => n + d.reservations.length, 0)).toBeGreaterThanOrEqual(200);
    const avis = all.flatMap((d) => d.reservations.filter((r) => r.avis));
    expect(avis.length).toBeGreaterThanOrEqual(40);
  });

  it("est déterministe (même graine, même date → mêmes données)", () => {
    expect(generateAgencyDemo(specs[0]!, NOW)).toEqual(all[0]);
  });

  it("textes affichés sans mention « démo », « fictif » ni TODO (décision de l'étape E12)", () => {
    const visibles = [
      ...[...GREEN_TREK_CIRCUITS, ...TANETY_CIRCUITS, ...RANOHIRA_CIRCUITS].flatMap((c) => [
        c.titre,
        c.resume,
        c.description,
      ]),
      ...[GREEN_TREK_GRAPH, TANETY_GRAPH, RANOHIRA_GRAPH].flatMap((g) =>
        g.etapes.flatMap((e) => [e.nom, e.description]),
      ),
      ...all.flatMap((d) =>
        d.reservations.flatMap((r) => [
          r.remarques ?? "",
          r.avis?.commentaire ?? "",
          ...r.participants.flatMap((p) => [p.nom, p.prenom]),
        ]),
      ),
    ];
    for (const texte of visibles) expect(texte).not.toMatch(/d[ée]mo|fictif|fictive|TODO|\[/i);
  });

  it("clients inventés : noms uniques, adresses sur le domaine réservé example.com", () => {
    const clients = generateClients(40, 1);
    expect(new Set(clients.map((c) => `${c.prenom} ${c.nom}`)).size).toBe(40);
    expect(exampleEmail({ prenom: "Élodie", nom: "Petit" })).toBe("elodie.petit@example.com");
    expect(generateClients(40, 1)).toEqual(clients); // déterministe
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
        // Le premier participant est le client qui réserve.
        const client = specs[index]!.clients[r.clientIndex]!;
        expect(r.participants[0]).toMatchObject({ prenom: client.prenom, nom: client.nom });
        // RG 17 : avis seulement pour une réservation terminée, après le séjour, note 1 à 5.
        if (r.avis) {
          expect(r.statut).toBe("TERMINEE");
          expect(r.avis.note).toBeGreaterThanOrEqual(1);
          expect(r.avis.note).toBeLessThanOrEqual(5);
          expect(r.avis.createdAt.getTime()).toBeGreaterThan(session.dateFin.getTime());
          expect(r.avis.createdAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
        }
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
      ["TT", TANETY_GRAPH, TANETY_CIRCUITS],
      ["RS", RANOHIRA_GRAPH, RANOHIRA_CIRCUITS],
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

    it("toutes les agences : lieux réels, source OpenStreetMap citée (licence ODbL)", () => {
      for (const e of [...TANETY_GRAPH.etapes, ...RANOHIRA_GRAPH.etapes]) {
        expect(e.description).toContain("OpenStreetMap");
        expect(e.description).toMatch(/OSM \d+/); // identifiant de l'objet OpenStreetMap
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
      ["TT", TANETY_GRAPH],
      ["RS", RANOHIRA_GRAPH],
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

    it("Tanety Trek et Ranohira Sentiers : graphe connexe", () => {
      expect(components(TANETY_GRAPH)).toHaveLength(1);
      expect(components(RANOHIRA_GRAPH)).toHaveLength(1);
    });
  });
});
