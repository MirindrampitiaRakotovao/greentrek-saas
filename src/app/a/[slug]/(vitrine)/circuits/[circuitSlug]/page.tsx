import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon, type IconName } from "@/components/ui/icon";
import { formatDuree, formatKm } from "@/components/vitrine/circuit-card";
import { CircuitMap } from "@/components/vitrine/circuit-map";
import { CircuitVisual } from "@/components/vitrine/circuit-visual";
import { formatDateRange, formatMoney } from "@/lib/format";
import { getVitrineAgency } from "@/lib/public-agency";
import { getPublicCircuit, type PublicCircuitDetail } from "@/lib/services/vitrine";
import { getTenantDb } from "@/lib/tenant";
import { TYPE_PARTENAIRE_LABELS } from "@/lib/validators/backoffice";
import { DIFFICULTE_LABELS, TYPE_ETAPE_LABELS } from "@/lib/validators/circuits";
import { loadVitrine } from "@/lib/vitrine-page";

type Props = PageProps<"/a/[slug]/circuits/[circuitSlug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, circuitSlug } = await params;
  const agence = await getVitrineAgency(slug);
  const circuit = agence ? await getPublicCircuit(getTenantDb(agence.id), circuitSlug) : null;
  return {
    title: circuit && agence ? `${circuit.titre} — ${agence.nom}` : "Circuit introuvable",
    description: circuit?.resume ?? undefined,
  };
}

/** Étapes regroupées par jour (« Jour 1 », …) ; celles sans jour sont regroupées à part. */
function groupByJour(etapes: PublicCircuitDetail["etapes"]) {
  const groups: { jour: number | null; etapes: PublicCircuitDetail["etapes"] }[] = [];
  for (const etape of etapes) {
    const last = groups.at(-1);
    if (last && last.jour === etape.jour) last.etapes.push(etape);
    else groups.push({ jour: etape.jour, etapes: [etape] });
  }
  return groups;
}

/** Détail public d'un circuit (§4 : carte, étapes, départs). RG 9 : circuit publié seulement. */
export default async function PublicCircuitPage({ params }: Props) {
  const { slug, circuitSlug } = await params;
  const { agence, db } = await loadVitrine(slug);
  const circuit = await getPublicCircuit(db, circuitSlug);
  if (!circuit) notFound();

  const base = `/a/${agence.slug}`;
  const distance = formatKm(circuit.trace?.distanceKm ?? circuit.distanceKm);
  const facts: { icon: IconName; label: string; value: string }[] = [
    { icon: "calendar", label: "Durée", value: formatDuree(circuit.dureeJours) },
    ...(distance ? [{ icon: "route" as const, label: "Distance", value: distance }] : []),
    { icon: "mountain", label: "Difficulté", value: DIFFICULTE_LABELS[circuit.difficulte] },
    { icon: "users", label: "Groupe", value: `${circuit.capaciteMax} pers. max.` },
  ];
  const steps = circuit.etapes.map((s) => ({ ...s.etape, id: s.id, ordre: s.ordre }));
  const trace = circuit.trace
    ? circuit.trace.path.map((p) => [p.latitude, p.longitude] as [number, number])
    : null;

  return (
    <article>
      <header className="relative overflow-hidden bg-gt-teal-900 text-white">
        <CircuitVisual
          imageUrl={circuit.imagePrincipaleUrl}
          landscapeKey={circuit.slug}
          className="absolute inset-0 size-full opacity-40"
        />
        <div className="absolute inset-0 bg-linear-to-t from-gt-teal-900 via-gt-teal-900/60 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-10 sm:px-6 sm:pt-28">
          <Link href={`${base}/circuits`} className="text-sm font-medium text-white/85 underline">
            ← Tous les circuits
          </Link>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold sm:text-4xl">{circuit.titre}</h1>
          {circuit.resume ? <p className="mt-3 max-w-2xl text-white/90">{circuit.resume}</p> : null}
          <dl className="mt-6 flex flex-wrap gap-3">
            {facts.map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur"
              >
                <Icon name={f.icon} className="size-4 text-gt-sand-300" />
                <dt className="sr-only">{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
          {/* Sur mobile, les départs sont en bas de page : accès direct. */}
          <a
            href="#departs"
            className="mt-6 inline-block rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-gt-teal-800 lg:hidden"
          >
            Voir les départs ({circuit.departs.length})
          </a>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-10">
          {circuit.description ? (
            <section aria-labelledby="titre-description">
              <h2 id="titre-description" className="text-xl font-semibold text-gt-teal-900">
                Le circuit
              </h2>
              <p className="mt-3 leading-relaxed whitespace-pre-line text-gt-teal-900/80">
                {circuit.description}
              </p>
            </section>
          ) : null}

          <section aria-labelledby="titre-itineraire">
            <h2 id="titre-itineraire" className="text-xl font-semibold text-gt-teal-900">
              Itinéraire
            </h2>
            {steps.length > 0 ? (
              <>
                <div className="mt-4 overflow-hidden rounded-3xl border border-gt-mist/70">
                  <CircuitMap steps={steps} trace={trace} />
                </div>
                <p className="mt-2 text-xs text-gt-teal-900/60">
                  {trace
                    ? "Tracé calculé à travers les sentiers du réseau de l'agence."
                    : "Tracé indicatif en ligne droite entre les étapes."}{" "}
                  Fond de carte © contributeurs OpenStreetMap.
                </p>
              </>
            ) : null}
            <ol className="mt-6 space-y-6">
              {groupByJour(circuit.etapes).map((group, index) => (
                <li key={`${group.jour ?? "x"}-${index}`}>
                  {group.jour !== null ? (
                    <p className="font-display text-2xl text-gt-teal-700">Jour {group.jour}</p>
                  ) : null}
                  <ol className="mt-2 space-y-3 border-l-2 border-gt-teal-200 pl-5">
                    {group.etapes.map((s) => (
                      <li key={s.id} className="relative">
                        <span
                          aria-hidden="true"
                          className="absolute top-0.5 -left-[33px] grid size-6 place-items-center rounded-full bg-gt-teal-700 text-xs font-bold text-white"
                        >
                          {s.ordre}
                        </span>
                        <p className="font-medium text-gt-teal-900">
                          <span className="sr-only">Étape {s.ordre} : </span>
                          {s.etape.nom}
                          <span className="ml-2 text-xs font-normal text-gt-teal-900/60">
                            {TYPE_ETAPE_LABELS[s.etape.type]}
                          </span>
                        </p>
                        {s.etape.description ? (
                          <p className="mt-0.5 text-sm text-gt-teal-900/70">
                            {s.etape.description}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ol>
          </section>

          {circuit.partenaires.length > 0 ? (
            <section aria-labelledby="titre-prestations">
              <h2 id="titre-prestations" className="text-xl font-semibold text-gt-teal-900">
                Avec nos partenaires locaux
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {circuit.partenaires.map((p) => (
                  <li key={p.id} className="rounded-2xl border border-gt-mist/70 p-4">
                    <p className="font-medium text-gt-teal-900">{p.prestation}</p>
                    <p className="text-sm text-gt-teal-900/70">
                      {p.partenaire.nom} · {TYPE_PARTENAIRE_LABELS[p.partenaire.type]}
                      {p.etape ? ` · ${p.etape.nom}` : ""}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-gt-teal-700">
                      {p.inclusDansPrix ? "Inclus dans le prix" : "En option, sur place"}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside
          id="departs"
          aria-labelledby="titre-departs"
          className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start"
        >
          <div className="rounded-3xl bg-white p-5 shadow-xl ring-1 shadow-gt-teal-900/10 ring-gt-mist/60">
            <p className="text-sm text-gt-teal-900/70">
              à partir de{" "}
              <span className="text-2xl font-bold text-gt-teal-900">
                {formatMoney(circuit.prixMin, agence.devise)}
              </span>{" "}
              / pers.
            </p>
            <h2 id="titre-departs" className="mt-4 font-semibold text-gt-teal-900">
              Prochains départs
            </h2>
            {circuit.departs.length === 0 ? (
              <p className="mt-2 text-sm text-gt-teal-900/70">
                Aucun départ ouvert pour l&apos;instant. Contactez l&apos;agence pour un départ sur
                mesure.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-gt-mist/60">
                {circuit.departs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gt-teal-900">
                        {formatDateRange(d.dateDebut, d.dateFin)}
                      </p>
                      <p className="text-xs text-gt-teal-900/70">
                        {d.placesLibres} place{d.placesLibres > 1 ? "s" : ""} libre
                        {d.placesLibres > 1 ? "s" : ""} · {formatMoney(d.prix, agence.devise)}
                      </p>
                    </div>
                    <Link
                      href={`${base}/reserver/${d.id}`}
                      className="shrink-0 rounded-full bg-gt-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-gt-teal-800"
                    >
                      Réserver
                      <span className="sr-only">
                        {" "}
                        le départ du {formatDateRange(d.dateDebut, d.dateFin)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </article>
  );
}
