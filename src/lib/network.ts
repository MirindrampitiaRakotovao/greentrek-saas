/**
 * Adresse de l'ordinateur sur le réseau local (Wi-Fi), pour le QR code des factures.
 *
 * « localhost » désigne toujours l'appareil lui-même : un QR code contenant
 * http://localhost:3000 ouvre… le téléphone, pas l'ordinateur. Quand l'application est
 * ouverte via localhost, on remplace donc l'hôte par l'adresse IPv4 privée de l'ordinateur :
 * un téléphone connecté au même Wi-Fi peut alors ouvrir la facture.
 */
export type NetworkInterfaceInfo = { address: string; family: string | number; internal: boolean };

/** Plages d'adresses privées (RFC 1918) : jamais une adresse publique. */
function isPrivateIpv4(address: string): boolean {
  return (
    /^10\./.test(address) ||
    /^192\.168\./.test(address) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address)
  );
}

/** Première adresse IPv4 privée non interne (192.168.x.x de préférence, le cas du Wi-Fi). */
export function lanAddress(
  interfaces: Record<string, NetworkInterfaceInfo[] | undefined>,
): string | null {
  const candidates = Object.values(interfaces)
    .flat()
    .filter(
      (i): i is NetworkInterfaceInfo =>
        !!i && !i.internal && (i.family === "IPv4" || i.family === 4) && isPrivateIpv4(i.address),
    )
    .map((i) => i.address);
  return candidates.find((a) => a.startsWith("192.168.")) ?? candidates[0] ?? null;
}

/** L'hôte désigne-t-il la machine elle-même (localhost, 127.x.x.x, ::1) ? */
export function isLoopbackHost(host: string): boolean {
  const hostname = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return hostname === "localhost" || /^127\./.test(hostname) || hostname === "::1";
}

/** Remplace un hôte « localhost » par l'adresse du réseau local, en gardant le port. */
export function reachableHost(host: string, lanIp: string | null): string {
  if (!lanIp || !isLoopbackHost(host)) return host;
  const port = /:(\d+)$/.exec(host)?.[1];
  return port ? `${lanIp}:${port}` : lanIp;
}
