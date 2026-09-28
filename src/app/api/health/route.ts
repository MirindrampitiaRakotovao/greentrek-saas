import { db } from "@/lib/db";

/**
 * Vérification de santé : l'application répond et la base MySQL est joignable.
 * Critère de fin de l'étape E0 (« la connexion MySQL fonctionne »).
 */
export async function GET(): Promise<Response> {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "connectée" });
  } catch (error: unknown) {
    // On journalise le détail côté serveur, sans l'exposer au client.
    console.error("Échec de la connexion MySQL :", error);
    return Response.json({ status: "erreur", database: "injoignable" }, { status: 503 });
  }
}
