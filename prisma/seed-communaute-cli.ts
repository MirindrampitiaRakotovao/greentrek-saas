/**
 * `npm run db:seed:communaute` : ajoute (ou recrée) les publications de départ de la
 * communauté dans la base actuelle, SANS vider le reste (contrairement à `npm run db:seed`).
 */
import "dotenv/config";

import { db } from "@/lib/db";

import { seedCommunaute } from "./seed-communaute";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Données de départ : ne pas lancer en production.");
  }
  const r = await seedCommunaute(db);
  console.log(
    `Communauté : ${r.supprimees} publication(s) de départ remplacée(s), ${r.publications} publications, ` +
      `${r.jaimes} « J'aime », ${r.commentaires} commentaires.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
