import "server-only";

import { networkInterfaces } from "node:os";

import { headers } from "next/headers";

import { publicBaseUrl } from "@/lib/invoice";
import { lanAddress } from "@/lib/network";

/**
 * Adresse absolue de l'application pour un lien ouvert hors du navigateur courant (QR code
 * d'une facture, lien d'un e-mail) : `PUBLIC_BASE_URL` si défini, sinon l'hôte de la requête,
 * « localhost » étant remplacé par l'adresse de l'ordinateur sur le Wi-Fi.
 */
export async function requestBaseUrl(): Promise<string> {
  const h = await headers();
  return publicBaseUrl(
    h.get("x-forwarded-host") ?? h.get("host"),
    h.get("x-forwarded-proto"),
    lanAddress(networkInterfaces()),
  );
}
