import Link from "next/link";

import { formatDateTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";
import { ACTION_LABELS, type JournalRow } from "@/lib/services/journal";
import { STATUT_AVIS_LABELS } from "@/lib/validators/avis";
import { STATUT_CIRCUIT_LABELS } from "@/lib/validators/circuits";
import { METHODE_PAIEMENT_LABELS } from "@/lib/validators/reservations";

const ENTITE_LABELS: Record<string, string> = {
  Reservation: "Réservation",
  Paiement: "Paiement",
  SessionDepart: "Départ",
  Circuit: "Circuit",
  Avis: "Avis",
  Utilisateur: "Compte",
  Agence: "Agence",
  Abonnement: "Abonnement",
  Plan: "Plan",
};

const DETAIL_LABELS: Record<string, string> = {
  reference: "Réf.",
  montant: "Montant",
  methode: "Moyen",
  statut: "Statut",
  role: "Rôle",
  actif: "Actif",
  reservationsAnnulees: "Réservations annulées",
  code: "Code",
};

/** Codes connus (statuts, moyens de paiement, rôles) traduits pour la lecture. */
const VALUE_LABELS: Record<string, string> = {
  ...STATUT_AVIS_LABELS,
  ...STATUT_CIRCUIT_LABELS,
  ...METHODE_PAIEMENT_LABELS,
  ...ROLE_LABELS,
  ACTIVE: "Active",
  SUSPENDUE: "Suspendue",
};

function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "oui" : "non";
  if (typeof value === "number") return value.toLocaleString("fr-FR");
  const text = String(value);
  return VALUE_LABELS[text] ?? text;
}

/**
 * Détails d'une entrée (objet JSON simple) sous forme lisible. Les identifiants techniques
 * (clés en « …Id ») ne sont pas affichés.
 */
function formatDetails(details: JournalRow["details"]): string {
  if (!details || typeof details !== "object" || Array.isArray(details)) return "";
  return Object.entries(details)
    .filter(([key]) => !key.endsWith("Id"))
    .map(([key, value]) => `${DETAIL_LABELS[key] ?? key} : ${formatValue(value)}`)
    .join(" · ");
}

/** Tableau du journal d'activité (agence ou plateforme). */
export function JournalTable({
  items,
  showAgency = false,
}: {
  items: readonly JournalRow[];
  /** Console plateforme : colonne « Agence », pas de lien vers le back-office. */
  showAgency?: boolean;
}) {
  const headers = ["Date", ...(showAgency ? ["Agence"] : []), "Auteur", "Action", "Détails"];
  return (
    <div className="gt-table-wrap">
      <table className="gt-table min-w-[760px]">
        <caption className="sr-only">Journal d&apos;activité</caption>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => {
            const entite = ENTITE_LABELS[entry.entite] ?? entry.entite;
            return (
              <tr key={entry.id}>
                <td className="whitespace-nowrap">{formatDateTime(entry.createdAt)}</td>
                {showAgency ? <td>{entry.agence?.nom ?? "Plateforme"}</td> : null}
                <td>
                  {entry.utilisateur
                    ? `${entry.utilisateur.prenom} ${entry.utilisateur.nom}`
                    : "Système"}
                </td>
                <td>
                  <span className="font-medium text-gt-teal-900">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                  {!showAgency && entry.entite === "Reservation" && entry.entiteId ? (
                    <Link
                      href={`/dashboard/reservations/${entry.entiteId}`}
                      className="block text-xs font-medium text-gt-teal-700 underline"
                    >
                      Voir la réservation
                    </Link>
                  ) : (
                    <span className="block text-xs text-gt-teal-900/75">{entite}</span>
                  )}
                </td>
                <td className="text-sm text-gt-teal-900/80">{formatDetails(entry.details)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
