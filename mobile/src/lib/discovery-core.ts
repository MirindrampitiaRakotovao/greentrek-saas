/**
 * Découverte du site Green Trek sur le réseau local : fonctions pures (testées par la suite
 * de tests du site, `tests/unit/mobile-discovery.test.ts`).
 */

export const DISCOVERY_PORT = 3000;
export const DISCOVERY_PATH = "/api/mobile/v1/decouverte";

/** Adresse IPv4 privée (RFC 1918) : seul le réseau local est parcouru, jamais Internet. */
export function isPrivateIPv4(address: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([m[1], m[2], m[3], m[4]].some((x) => Number(x) > 255)) return false;
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/** Partage de connexion d'un iPhone : le téléphone est 172.20.10.1, les appareils .2 à .14. */
const IPHONE_HOTSPOT = Array.from({ length: 13 }, (_, i) => `172.20.10.${i + 2}`);

/**
 * Adresses à essayer : les voisins (même /24) de chaque adresse privée du téléphone, en
 * commençant près de lui, sans le téléphone lui-même ; puis le partage de connexion iPhone.
 * Au plus `maxSubnets` réseaux (un téléphone en a rarement plus de deux).
 */
export function candidateHosts(addresses: readonly string[], maxSubnets = 3): string[] {
  const own = new Set(addresses);
  const subnets: { prefix: string; self: number }[] = [];
  for (const address of addresses) {
    if (!isPrivateIPv4(address)) continue;
    const parts = address.split(".");
    const prefix = parts.slice(0, 3).join(".");
    if (subnets.some((s) => s.prefix === prefix)) continue;
    subnets.push({ prefix, self: Number(parts[3]) });
    if (subnets.length >= maxSubnets) break;
  }
  const hosts: string[] = [];
  for (const { prefix, self } of subnets) {
    const order = Array.from({ length: 254 }, (_, i) => i + 1).sort(
      (x, y) => Math.abs(x - self) - Math.abs(y - self) || x - y,
    );
    for (const n of order) {
      const host = `${prefix}.${n}`;
      if (!own.has(host)) hosts.push(host);
    }
  }
  for (const host of IPHONE_HOTSPOT) if (!own.has(host) && !hosts.includes(host)) hosts.push(host);
  return hosts;
}

export function serverUrl(host: string, port = DISCOVERY_PORT): string {
  return `http://${host}:${port}`;
}

/** La réponse vient-elle bien du site Green Trek (et pas d'un autre service du port 3000) ? */
export function isGreenTrekMark(body: unknown): boolean {
  return (
    !!body &&
    typeof body === "object" &&
    (body as { service?: unknown }).service === "greentrek" &&
    (body as { api?: unknown }).api === "v1"
  );
}

/**
 * Essaie les adresses (`preferred` d'abord, puis les autres par paquets de `concurrency`) et
 * renvoie la première qui répond comme Green Trek, ou null.
 */
export async function findServer(
  urls: readonly string[],
  probe: (url: string) => Promise<boolean>,
  options: { preferred?: string | null; concurrency?: number } = {},
): Promise<string | null> {
  const { preferred, concurrency = 48 } = options;
  if (preferred && (await probe(preferred))) return preferred;
  const rest = urls.filter((u) => u !== preferred);
  let next = 0;
  let found: string | null = null;
  async function worker() {
    while (!found && next < rest.length) {
      const url = rest[next++]!;
      if (await probe(url)) found ??= url;
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, rest.length) }, worker));
  return found;
}
