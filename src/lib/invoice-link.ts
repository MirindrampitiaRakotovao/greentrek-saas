import "server-only";

import { formatDate, formatDateRange, formatMoney } from "@/lib/format";
import {
  invoiceNumber,
  invoicePath,
  invoiceQrText,
  invoiceSecret,
  signInvoice,
} from "@/lib/invoice";
import { requestBaseUrl } from "@/lib/public-url";
import { qrSvg } from "@/lib/qr";
import { ETAT_FACTURE_LABELS, type Invoice } from "@/lib/services/factures";

/**
 * Lien signé d'une facture et son QR code. Le QR code contient les informations de la facture
 * en texte (lisibles sans réseau) suivies du lien (adresse absolue, ouverte depuis le même
 * Wi-Fi que l'ordinateur). Calculé sur le serveur uniquement : le secret ne quitte jamais le
 * serveur.
 */
export async function invoiceLink(invoice: Invoice, agenceId: string) {
  const { agence, reservation: r } = invoice;
  const path = invoicePath(agence.slug, r.id, signInvoice(invoiceSecret(), agenceId, r.id));
  const url = `${await requestBaseUrl()}${path}`;
  const devise = agence.devise;
  const text = invoiceQrText({
    numero: invoiceNumber(r.reference),
    etat: ETAT_FACTURE_LABELS[invoice.etat],
    agence: agence.nom,
    reference: r.reference,
    circuit: r.session.circuit.titre,
    dates: formatDateRange(r.session.dateDebut, r.session.dateFin),
    personnes: r.nombrePersonnes,
    total: formatMoney(r.montantTotal, devise),
    paye: formatMoney(invoice.paye, devise),
    reste: formatMoney(invoice.etat === "ANNULEE" ? 0 : invoice.reste, devise),
    emiseLe: formatDate(r.confirmeeAt ?? r.createdAt),
    url,
  });
  return { path, url, qr: await qrSvg(text, "L") };
}
