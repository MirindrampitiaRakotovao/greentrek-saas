// Seed de la base. E0 : fichier vide, rempli à l'étape E1
// (3 agences, utilisateurs par rôle, graphe de Green Trek Mada).
async function main(): Promise<void> {
  console.log("Seed : rien à insérer pour l'instant (étape E0).");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
