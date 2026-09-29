import Link from "next/link";

import type { VitrineAgency } from "@/lib/public-agency";

/**
 * Pied de page (§8.4, section 10) : teal sombre, liens utiles et contact, bande sable avec
 * la mention légale. Les coordonnées absentes ne sont pas inventées : « à venir ».
 */
export function SiteFooter({
  agence,
  circuits,
}: {
  agence: VitrineAgency;
  circuits: readonly { titre: string; slug: string }[];
}) {
  const base = `/a/${agence.slug}`;
  const lieu = [agence.ville, agence.pays].filter(Boolean).join(", ");
  return (
    <footer id="contact" className="mt-auto scroll-mt-20 bg-gt-teal-800 text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <p className="font-display text-3xl text-gt-cream">{agence.nom}</p>
          {agence.description ? (
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">
              {agence.description}
            </p>
          ) : null}
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-gt-sand-300 uppercase">
            Circuits
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {circuits.slice(0, 5).map((c) => (
              <li key={c.slug}>
                <Link href={`${base}/circuits/${c.slug}`} className="text-white/85 hover:underline">
                  {c.titre}
                </Link>
              </li>
            ))}
            <li>
              <Link href={`${base}/circuits`} className="font-medium text-white hover:underline">
                Tous les circuits →
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-gt-sand-300 uppercase">
            Contact
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-white/85">
            {lieu ? <li>{lieu}</li> : null}
            {agence.adresse ? <li>{agence.adresse}</li> : null}
            {agence.telephone ? (
              <li>
                <a
                  href={`tel:${agence.telephone.replace(/[^+0-9]/g, "")}`}
                  className="hover:underline"
                >
                  {agence.telephone}
                </a>
              </li>
            ) : null}
            {agence.email ? (
              <li>
                <a href={`mailto:${agence.email}`} className="hover:underline">
                  {agence.email}
                </a>
              </li>
            ) : null}
            {!agence.telephone && !agence.email ? (
              // TODO(données terrain) : e-mail et téléphone officiels de l'agence.
              <li className="text-white/65">Coordonnées téléphoniques et e-mail à venir.</li>
            ) : null}
            <li>
              <Link href={`${base}/connexion`} className="hover:underline">
                Espace voyageur
              </Link>
            </li>
            <li>
              <Link href={`${base}/credits-photos`} className="hover:underline">
                Crédits photos
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="bg-gt-sand-300 px-4 py-3 text-center text-xs text-gt-teal-900">
        © {agence.nom} · Site propulsé par la plateforme Green Trek (projet de fin d&apos;études,
        démonstration locale : paiements simulés).
      </div>
    </footer>
  );
}
