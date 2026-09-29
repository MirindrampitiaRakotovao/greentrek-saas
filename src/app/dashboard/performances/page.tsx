import type { Metadata } from "next";

import { BenchmarkPanel } from "@/components/itineraires/benchmark-panel";
import { requireAgencyUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Analyse des performances — Green Trek" };

/** Analyse des performances de Dijkstra et d'A* (§6.5) : ADMIN_AGENCE et STAFF. */
export default async function PerformancesPage() {
  await requireAgencyUser(["ADMIN_AGENCE", "STAFF"]);
  return <BenchmarkPanel />;
}
