import { formatDate, formatDateRange, formatDateTime, formatMoney } from "@/lib/format";
import { invoiceNumber } from "@/lib/invoice";
import { ETAT_FACTURE_LABELS, type Invoice } from "@/lib/services/factures";
import { METHODE_PAIEMENT_LABELS, STATUT_PAIEMENT_LABELS } from "@/lib/validators/reservations";

const ETAT_STYLES = {
  ACQUITTEE: "bg-emerald-100 text-emerald-900",
  PROFORMA: "bg-gt-sand-200 text-gt-teal-900",
  ANNULEE: "bg-red-100 text-red-900",
} as const;

/**
 * Facture d'une réservation, au format page A4 (impression ou PDF via le navigateur).
 * Document SIMULÉ (§1.4) : mention « sans valeur fiscale », pas de TVA. Les identifiants
 * fiscaux de l'agence (NIF, STAT) ne sont pas inventés : TODO(données terrain).
 */
export function InvoiceDocument({ invoice, qr }: { invoice: Invoice; qr?: string }) {
  const { agence, reservation: r } = invoice;
  const devise = agence.devise;
  const lieu = [agence.adresse, agence.ville, agence.pays].filter(Boolean).join(", ");

  return (
    <article className="mx-auto w-full max-w-[794px] bg-white p-8 text-sm text-gt-teal-900 shadow-sm ring-1 ring-gt-mist/70 sm:p-12 print:max-w-none print:p-0 print:shadow-none print:ring-0">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-gt-teal-700 pb-6">
        <div>
          <p className="font-display text-2xl font-medium text-gt-teal-800">{agence.nom}</p>
          {lieu ? <p className="mt-1 text-gt-teal-900/75">{lieu}</p> : null}
          <p className="text-gt-teal-900/75">
            {[agence.telephone, agence.email].filter(Boolean).join(" · ") || "Coordonnées à venir"}
          </p>
          {/* TODO(données terrain) : NIF et STAT de l'agence (identifiants fiscaux). */}
          <p className="mt-1 text-xs text-gt-teal-900/55">NIF : à compléter · STAT : à compléter</p>
        </div>
        <div className="text-right">
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${ETAT_STYLES[invoice.etat]}`}
          >
            {ETAT_FACTURE_LABELS[invoice.etat]}
          </span>
          <p className="mt-2 font-mono text-base font-semibold">{invoiceNumber(r.reference)}</p>
          <p className="text-gt-teal-900/70">Émise le {formatDate(r.confirmeeAt ?? r.createdAt)}</p>
          <p className="text-gt-teal-900/70">Réservation {r.reference}</p>
        </div>
      </header>

      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold tracking-wide text-gt-teal-600 uppercase">
            Facturé à
          </h2>
          <p className="mt-1 font-medium">
            {r.client.prenom} {r.client.nom}
          </p>
          <p className="text-gt-teal-900/75">{r.client.email}</p>
          {r.client.telephone ? <p className="text-gt-teal-900/75">{r.client.telephone}</p> : null}
        </div>
        <div>
          <h2 className="text-xs font-semibold tracking-wide text-gt-teal-600 uppercase">Voyage</h2>
          <p className="mt-1 font-medium">{r.session.circuit.titre}</p>
          <p className="text-gt-teal-900/75">
            {formatDateRange(r.session.dateDebut, r.session.dateFin)} ·{" "}
            {r.session.circuit.dureeJours} jour{r.session.circuit.dureeJours > 1 ? "s" : ""}
          </p>
        </div>
      </section>

      <table className="mt-8 w-full text-left">
        <caption className="sr-only">Détail de la facture</caption>
        <thead>
          <tr className="border-b border-gt-mist text-xs text-gt-teal-900/60">
            <th scope="col" className="py-2 font-medium">
              Désignation
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Quantité
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Prix unitaire
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Montant
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gt-mist/70">
            <td className="py-3">
              Circuit « {r.session.circuit.titre} »
              <span className="block text-xs text-gt-teal-900/60">
                Départ du {formatDate(r.session.dateDebut)}, par personne
              </span>
            </td>
            <td className="py-3 text-right">{r.nombrePersonnes}</td>
            <td className="py-3 text-right whitespace-nowrap">
              {formatMoney(invoice.prixUnitaire, devise)}
            </td>
            <td className="py-3 text-right whitespace-nowrap">
              {formatMoney(r.montantTotal, devise)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
        {qr ? (
          <figure className="flex items-center gap-3">
            <span
              className="block size-24 [&>svg]:size-full"
              // SVG produit sur le serveur par la bibliothèque qrcode à partir de NOTRE adresse.
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <figcaption className="max-w-40 text-xs text-gt-teal-900/65">
              Scannez pour consulter cette facture en ligne.
            </figcaption>
          </figure>
        ) : (
          <span />
        )}
        <dl className="ml-auto w-full max-w-64 space-y-1.5">
          <div className="flex justify-between">
            <dt className="text-gt-teal-900/70">Total</dt>
            <dd className="font-semibold whitespace-nowrap">
              {formatMoney(r.montantTotal, devise)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gt-teal-900/70">Déjà payé</dt>
            <dd className="whitespace-nowrap">{formatMoney(invoice.paye, devise)}</dd>
          </div>
          {invoice.rembourse > 0 ? (
            <div className="flex justify-between">
              <dt className="text-gt-teal-900/70">Remboursé</dt>
              <dd className="whitespace-nowrap">{formatMoney(invoice.rembourse, devise)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t-2 border-gt-teal-700 pt-2 text-base">
            <dt className="font-semibold">Reste à payer</dt>
            <dd className="font-bold whitespace-nowrap">
              {formatMoney(invoice.etat === "ANNULEE" ? 0 : invoice.reste, devise)}
            </dd>
          </div>
        </dl>
      </div>

      {r.paiements.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xs font-semibold tracking-wide text-gt-teal-600 uppercase">
            Paiements
          </h2>
          <ul className="mt-2 divide-y divide-gt-mist/70">
            {r.paiements.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 py-1.5">
                <span>
                  {METHODE_PAIEMENT_LABELS[p.methode]} · {STATUT_PAIEMENT_LABELS[p.statut]}
                  {p.payeLe ? ` · ${formatDateTime(p.payeLe)}` : ""}
                </span>
                <span className="whitespace-nowrap">{formatMoney(p.montant, devise)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-10 border-t border-gt-mist pt-4 text-xs text-gt-teal-900/60">
        Document généré par la plateforme Green Trek (projet de fin d&apos;études, démonstration
        locale). Paiements simulés : <strong>document sans valeur fiscale</strong>.
        {invoice.etat === "ANNULEE" && r.annuleeAt
          ? ` Réservation annulée le ${formatDate(r.annuleeAt)}.`
          : ""}
      </footer>
    </article>
  );
}
