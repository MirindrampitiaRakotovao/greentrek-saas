import "server-only";

import { invoicePath, invoiceSecret, signInvoice } from "@/lib/invoice";
import { requestBaseUrl } from "@/lib/public-url";
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
  const url = `${await requestBaseUrl()}${path}`;
  return { path, url, qr: await qrSvg(url) };
}
