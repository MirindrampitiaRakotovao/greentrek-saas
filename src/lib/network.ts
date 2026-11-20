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

/**
 * L'hôte est-il local (cet ordinateur ou le réseau local : localhost, *.localhost, *.local,
 * adresse IPv4 privée) ? Sinon, la requête arrive d'Internet par le tunnel de démonstration :
 * seules les factures y sont servies (voir `src/proxy.ts`).
 */
export function isLocalHost(host: string | null | undefined): boolean {
  if (!host) return true;
  const hostname = host
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^\[|\]$/g, "");
  return (
    isLoopbackHost(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    isPrivateIpv4(hostname)
  );
}

/** Pages servies à une requête venue d'Internet (tunnel) : la facture signée et ses fichiers. */
export function isPublicTunnelPath(pathname: string): boolean {
  return (
    /^\/a\/[a-z0-9-]+\/facture\/[a-z0-9]+$/.test(pathname) ||
    /^\/_next\//.test(pathname) ||
    /^\/(logo|fonts)\//.test(pathname) ||
    /^\/fichiers\/logos\//.test(pathname) ||
    /^\/(favicon\.ico|icon[^/]*|apple-icon[^/]*)$/.test(pathname)
  );
}

/** Adresse d'un tunnel de démonstration valide (https, sous-domaine de trycloudflare.com). */
export function isTunnelUrl(value: string | null | undefined): value is string {
  return !!value && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(value);
}

/** Remplace un hôte « localhost » par l'adresse du réseau local, en gardant le port. */
export function reachableHost(host: string, lanIp: string | null): string {
  if (!lanIp || !isLoopbackHost(host)) return host;
  const port = /:(\d+)$/.exec(host)?.[1];
  return port ? `${lanIp}:${port}` : lanIp;
}
