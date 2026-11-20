import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/mobile/v1/decouverte/route";

import {
  candidateHosts,
  findServer,
  isGreenTrekMark,
  isPrivateIPv4,
  serverUrl,
} from "../../mobile/src/lib/discovery-core";

/**
 * Découverte automatique du site par l'application (APK) : adresses à essayer, reconnaissance
 * du serveur, recherche. Le parcours réseau réel se vérifie sur téléphone.
 */
describe("adresses à essayer", () => {
  it("réseau local seulement (RFC 1918), jamais une adresse publique", () => {
    for (const a of ["192.168.1.23", "10.0.0.5", "172.16.0.2", "172.31.255.1"]) {
      expect(isPrivateIPv4(a), a).toBe(true);
    }
    for (const a of ["8.8.8.8", "172.32.0.1", "100.64.0.1", "192.168.1.300", "abc", ""]) {
      expect(isPrivateIPv4(a), a).toBe(false);
    }
    expect(candidateHosts(["100.72.4.9"]).every((h) => h.startsWith("172.20.10."))).toBe(true);
  });

  it("même Wi-Fi : les voisins du téléphone, les plus proches d'abord, sans lui-même", () => {
    const hosts = candidateHosts(["192.168.1.23"]);
    expect(hosts.slice(0, 4)).toEqual([
      "192.168.1.22",
      "192.168.1.24",
      "192.168.1.21",
      "192.168.1.25",
    ]);
    expect(hosts).not.toContain("192.168.1.23");
    expect(hosts.filter((h) => h.startsWith("192.168.1."))).toHaveLength(253);
  });

  it("partage de connexion : le réseau du point d'accès (téléphone en .1) est parcouru", () => {
    // Téléphone Android en point d'accès : interface « ap0 » 192.168.43.1, et sa 4G en 100.x.
    const hosts = candidateHosts(["100.72.4.9", "192.168.43.1"]);
    expect(hosts[0]).toBe("192.168.43.2");
    expect(hosts).toContain("192.168.43.254");
    expect(hosts).not.toContain("192.168.43.1");
    // Partage de connexion d'un iPhone : petit réseau toujours ajouté.
    expect(hosts).toContain("172.20.10.2");
  });

  it("Wi-Fi et point d'accès à la fois : les deux réseaux, au plus trois", () => {
    const hosts = candidateHosts(["192.168.1.23", "192.168.43.1", "10.0.0.2", "10.1.0.2"]);
    const subnets = new Set(
      hosts
        .filter((h) => !h.startsWith("172.20.10."))
        .map((h) => h.split(".").slice(0, 3).join(".")),
    );
    expect([...subnets]).toEqual(["192.168.1", "192.168.43", "10.0.0"]);
    expect(serverUrl("192.168.43.2")).toBe("http://192.168.43.2:3000");
  });
});

describe("reconnaissance et recherche du serveur", () => {
  it("la route de découverte répond la marque Green Trek, reconnue par l'application", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    expect(isGreenTrekMark(body)).toBe(true);
    expect(isGreenTrekMark({ service: "autre", api: "v1" })).toBe(false);
    expect(isGreenTrekMark(null)).toBe(false);
  });

  it("garde l'adresse mémorisée si elle répond encore, sans parcourir le réseau", async () => {
    const tried: string[] = [];
    const probe = async (u: string) => (tried.push(u), u === "http://192.168.1.10:3000");
    const urls = candidateHosts(["192.168.1.23"]).map((h) => serverUrl(h));
    expect(await findServer(urls, probe, { preferred: "http://192.168.1.10:3000" })).toBe(
      "http://192.168.1.10:3000",
    );
    expect(tried).toHaveLength(1);
  });

  it("adresse mémorisée muette : trouve la nouvelle, ou null s'il n'y a rien", async () => {
    const urls = candidateHosts(["192.168.43.1"]).map((h) => serverUrl(h));
    const nouveau = "http://192.168.43.57:3000";
    expect(
      await findServer(urls, async (u) => u === nouveau, { preferred: "http://192.168.1.10:3000" }),
    ).toBe(nouveau);
    expect(await findServer(urls, async () => false, { preferred: null })).toBeNull();
  });
});
