import "server-only";

import { invoicePath, invoiceSecret, signInvoice } from "@/lib/invoice";
import { invoiceBaseUrl } from "@/lib/public-url";
import { qrSvg } from "@/lib/qr";
import type { Invoice } from "@/lib/services/factures";

/**
 * Lien signé d'une facture et son QR code. Le QR code ne contient QUE le lien : l'appareil
 * photo d'un téléphone l'ouvre directement (un QR de texte n'est pas ouvert par beaucoup
 * d'appareils Android). Adresse : tunnel de démonstration s'il tourne (tout réseau), sinon
 * Wi-Fi de l'ordinateur (voir `invoiceBaseUrl`). Calculé sur le serveur : le secret ne quitte
 * jamais le serveur.
 */
export async function invoiceLink(invoice: Invoice, agenceId: string) {
  const { agence, reservation: r } = invoice;
  const path = invoicePath(agence.slug, r.id, signInvoice(invoiceSecret(), agenceId, r.id));
  const url = `${await invoiceBaseUrl()}${path}`;
  return { path, url, qr: await qrSvg(url, "M") };
}
