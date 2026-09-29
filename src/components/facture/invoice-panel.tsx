import { Card } from "@/components/dashboard/widgets";
import { InvoiceDocument } from "@/components/facture/invoice-document";
import type { Invoice } from "@/lib/services/factures";

/**
 * Aperçu de la facture (réduction de la page A4), QR code à scanner et lien vers la facture
 * complète, imprimable. Utilisé dans le back-office et dans l'espace client.
 */
export function InvoicePanel({
  invoice,
  link,
}: {
  invoice: Invoice;
  link: { path: string; url: string; qr: string };
}) {
  return (
    <Card title="Facture" className="min-w-0">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
        {/* Aperçu : la facture réelle, réduite ; non interactive et masquée aux lecteurs d'écran
            (la facture complète est à un clic). */}
        <div
          aria-hidden="true"
          className="relative h-72 overflow-hidden rounded-2xl bg-gt-canvas ring-1 ring-gt-mist/70"
        >
          <div className="pointer-events-none absolute top-4 left-1/2 w-[794px] origin-top -translate-x-1/2 scale-[0.42] select-none sm:scale-50">
            <InvoiceDocument invoice={invoice} />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-gt-canvas" />
        </div>
        <div className="flex flex-col items-center gap-3 text-center md:w-48">
          <span
            className="block size-40 rounded-xl bg-white p-2 ring-1 ring-gt-mist [&>svg]:size-full"
            role="img"
            aria-label="QR code de la facture"
            // SVG produit sur le serveur par la bibliothèque qrcode à partir de NOTRE adresse.
            dangerouslySetInnerHTML={{ __html: link.qr }}
          />
          <p className="text-xs text-gt-teal-900/65">
            Scannez avec un téléphone pour ouvrir la facture.
          </p>
          <a
            href={link.path}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-gt-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gt-teal-800"
          >
            Ouvrir la facture
          </a>
        </div>
      </div>
    </Card>
  );
}
