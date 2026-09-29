"use server";

import { revalidatePath } from "next/cache";

import { authorize, parseInput, toActionResult } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { type BenchmarkRow, runBenchmark } from "@/lib/graph/benchmark";
import { CRITERIA_PRESETS } from "@/lib/graph/weights";
import { type AlgorithmOutcome, computeItineraire, traceCircuit } from "@/lib/services/itineraires";
import { idSchema } from "@/lib/validators/backoffice";
import { benchmarkSchema, itineraireSchema } from "@/lib/validators/itineraires";

/*
 * Actions serveur du calcul d'itinéraire (étape E6b). Le calcul lui-même est fait par le
 * module pur `src/lib/graph/` ; ces actions contrôlent l'accès, valident l'entrée (Zod) et
 * appellent le service.
 */

export type ItineraireActionResult = ActionResult & { outcomes?: AlgorithmOutcome[] };

/** Calcul d'un itinéraire (ou comparaison Dijkstra / A*) : tout le personnel de l'agence. */
export async function calculerItineraireAction(input: unknown): Promise<ItineraireActionResult> {
  const auth = await authorize("lire", "troncon");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(itineraireSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await computeItineraire(auth.db, auth.user.agenceId, auth.user.id, parsed.data);
  if (!result.ok) return toActionResult(result);
  revalidatePath("/dashboard/itineraires");
  return { outcomes: result.data };
}

/** Tracé réel d'un circuit à travers les tronçons (met à jour sa distance). */
export async function tracerCircuitAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "circuit");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(idSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await traceCircuit(auth.db, auth.user.agenceId, auth.user.id, parsed.data.id);
  if (result.ok) revalidatePath("/dashboard/circuits", "layout");
  return toActionResult(
    result,
    result.ok
      ? `Tracé calculé : ${result.data.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} km par les tronçons.`
      : undefined,
  );
}

export type BenchmarkActionResult = ActionResult & { rows?: BenchmarkRow[] };

/**
 * Banc d'essai sur graphes aléatoires (§6.5, page « Analyse des performances »). Calcul
 * pur, sans base de données ; tailles 50, 200, 1 000 et 5 000 nœuds, 20 paires par taille.
 */
export async function lancerBenchmarkAction(input: unknown): Promise<BenchmarkActionResult> {
  const auth = await authorize("modifier", "circuit");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(benchmarkSchema, input);
  if (!parsed.ok) return parsed.result;
  const rows = runBenchmark([50, 200, 1000, 5000], 20, CRITERIA_PRESETS[parsed.data.critere]);
  return { rows };
}
