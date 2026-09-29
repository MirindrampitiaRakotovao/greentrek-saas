import "server-only";

import { headers } from "next/headers";

import { invoicePath, invoiceSecret, publicBaseUrl, signInvoice } from "@/lib/invoice";
import { qrSvg } from "@/lib/qr";

/**
 * Lien signé d'une facture et son QR code (adresse absolue : un téléphone doit pouvoir
 * l'ouvrir). Calculé sur le serveur uniquement : le secret ne quitte jamais le serveur.
 */
export async function invoiceLink(agenceSlug: string, agenceId: string, reservationId: string) {
  const path = invoicePath(
    agenceSlug,
    reservationId,
    signInvoice(invoiceSecret(), agenceId, reservationId),
  );
  const h = await headers();
  const url = `${publicBaseUrl(h.get("x-forwarded-host") ?? h.get("host"), h.get("x-forwarded-proto"))}${path}`;
  return { path, url, qr: await qrSvg(url) };
}
