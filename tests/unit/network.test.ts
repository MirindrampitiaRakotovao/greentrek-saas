import { afterEach, describe, expect, it } from "vitest";

import { publicBaseUrl } from "@/lib/invoice";
import { isLoopbackHost, lanAddress, reachableHost } from "@/lib/network";

describe("adresse du QR code des factures", () => {
  const interfaces = {
    lo0: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
    utun0: [{ address: "10.8.0.2", family: "IPv4", internal: false }],
    en0: [
      { address: "fe80::1", family: "IPv6", internal: false },
      { address: "192.168.0.101", family: "IPv4", internal: false },
    ],
  };

  it("trouve l'adresse IPv4 privée du Wi-Fi (192.168.x.x de préférence)", () => {
    expect(lanAddress(interfaces)).toBe("192.168.0.101");
    expect(lanAddress({ utun0: interfaces.utun0 })).toBe("10.8.0.2");
    expect(lanAddress({ lo0: interfaces.lo0 })).toBeNull();
    // Jamais une adresse publique.
    expect(lanAddress({ en0: [{ address: "41.188.1.2", family: 4, internal: false }] })).toBeNull();
  });

  it("remplace localhost par l'adresse du réseau local, en gardant le port", () => {
    expect(isLoopbackHost("localhost:3000")).toBe(true);
    expect(isLoopbackHost("127.0.0.1:3123")).toBe(true);
    expect(isLoopbackHost("[::1]:3000")).toBe(true);
    expect(reachableHost("localhost:3000", "192.168.0.101")).toBe("192.168.0.101:3000");
    expect(reachableHost("192.168.0.101:3000", "192.168.0.101")).toBe("192.168.0.101:3000");
    expect(reachableHost("greentrek.exemple.org", "192.168.0.101")).toBe("greentrek.exemple.org");
    expect(reachableHost("localhost:3000", null)).toBe("localhost:3000");
  });

  describe("PUBLIC_BASE_URL", () => {
    const saved = process.env.PUBLIC_BASE_URL;
    afterEach(() => {
      process.env.PUBLIC_BASE_URL = saved;
    });

    it("sans configuration : hôte de la requête, localhost remplacé par l'adresse Wi-Fi", () => {
      process.env.PUBLIC_BASE_URL = "";
      expect(publicBaseUrl("localhost:3000", null, "192.168.0.101")).toBe(
        "http://192.168.0.101:3000",
      );
    });

    it("avec configuration (tunnel Internet) : adresse imposée, sans / final", () => {
      process.env.PUBLIC_BASE_URL = "https://demo-green-trek.trycloudflare.com/";
      expect(publicBaseUrl("localhost:3000", null, "192.168.0.101")).toBe(
        "https://demo-green-trek.trycloudflare.com",
      );
    });
  });
});
