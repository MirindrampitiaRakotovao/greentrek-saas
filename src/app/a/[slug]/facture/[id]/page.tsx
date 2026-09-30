import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InvoiceDocument } from "@/components/facture/invoice-document";
import { PrintButton } from "@/components/facture/print-button";
import { invoiceSecret, verifyInvoiceSignature } from "@/lib/invoice";
import { invoiceLink } from "@/lib/invoice-link";
import { getInvoice } from "@/lib/services/factures";
import { loadVitrine } from "@/lib/vitrine-page";

export const metadata: Metadata = {
  title: "Facture",
  // Page accessible par lien signé : jamais indexée par un moteur de recherche.
  robots: { index: false, follow: false },
};

/**
 * Facture d'une réservation, ouverte depuis le QR code ou le bouton « Ouvrir la facture ».
 * Accès sans connexion, mais uniquement avec la signature de l'adresse (`?s=`) : sans elle,
 * ou avec une signature d'une autre réservation ou agence, page 404 (voir `src/lib/invoice.ts`).
 */
export default async function FacturePage({
  params,
  searchParams,
}: PageProps<"/a/[slug]/facture/[id]">) {
  const { slug, id } = await params;
  const { agence, db } = await loadVitrine(slug);
  const s = (await searchParams).s;
  if (
    !verifyInvoiceSignature(invoiceSecret(), agence.id, id, typeof s === "string" ? s : undefined)
  ) {
    notFound();
  }
  const invoice = await getInvoice(db, agence.id, id);
  if (!invoice) notFound();
  const link = await invoiceLink(agence.slug, agence.id, id);

  return (
    <main
      id="contenu"
      tabIndex={-1}
      className="min-h-screen bg-gt-canvas px-4 py-8 outline-none print:bg-white print:p-0"
    >
      <div className="mx-auto mb-4 flex max-w-[794px] flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-gt-teal-900/75">Facture · {agence.nom}</p>
        <PrintButton />
      </div>
      <InvoiceDocument invoice={invoice} qr={link.qr} />
    </main>
  );
}
