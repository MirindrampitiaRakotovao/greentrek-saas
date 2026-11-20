// Tunnel de démonstration : `npm run tunnel` (le site doit tourner sur le port 3000).
// Lance un tunnel Cloudflare gratuit (sans compte) qui donne une adresse publique
// https://….trycloudflare.com vers http://localhost:3000, l'écrit dans `.tunnel-url`
// (ignoré par git) pour que les QR codes des factures l'utilisent, et l'efface à l'arrêt.
// Par ce tunnel, le site ne sert QUE les factures signées (voir src/proxy.ts).
import { spawn } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FILE = join(process.cwd(), ".tunnel-url");
const PORT = process.env.PORT ?? "3000";
const clean = () => rmSync(FILE, { force: true });
clean();

const child = spawn(
  "cloudflared",
  ["tunnel", "--no-autoupdate", "--url", `http://localhost:${PORT}`],
  { stdio: ["ignore", "pipe", "pipe"] },
);
child.on("error", (error) => {
  console.error(
    error.code === "ENOENT"
      ? "cloudflared est introuvable : installez-le avec « brew install cloudflared »."
      : error.message,
  );
  process.exit(1);
});

let found = false;
const watch = (chunk) => {
  const url = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(chunk.toString())?.[0];
  if (url && !found) {
    found = true;
    writeFileSync(FILE, `${url}\n`);
    console.log(`\nTunnel ouvert : ${url}`);
    console.log("Les QR codes des factures utilisent maintenant cette adresse (tout réseau).");
    console.log("Par le tunnel, seules les factures sont accessibles. Ctrl+C pour arrêter.\n");
  }
};
child.stdout.on("data", watch);
child.stderr.on("data", watch);

const stop = () => {
  clean();
  child.kill("SIGINT");
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => {
  clean();
  if (!found) console.error("Le tunnel n'a pas pu s'ouvrir (connexion Internet ?).");
  process.exit(code ?? 0);
});
