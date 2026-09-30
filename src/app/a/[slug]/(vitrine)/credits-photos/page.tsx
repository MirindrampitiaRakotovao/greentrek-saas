import type { Metadata } from "next";

import { BlurBlobs } from "@/components/vitrine/blur-blobs";
import { PHOTO_CREDITS, PHOTOS_FOURNIES } from "@/lib/photo-credits";
import { loadVitrine } from "@/lib/vitrine-page";

export const metadata: Metadata = { title: "Crédits photos" };

/**
 * Crédits des photos du site (§8.1) : auteur, licence et source de chaque photo sous licence
 * Creative Commons, comme ces licences l'exigent. Fond de carte : © contributeurs
 * OpenStreetMap (ODbL), déjà cité sous chaque carte.
 */
export default async function CreditsPhotosPage({ params }: PageProps<"/a/[slug]/credits-photos">) {
  await loadVitrine((await params).slug);
  const credits = Object.entries(PHOTO_CREDITS);

  return (
    <div className="relative isolate mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <BlurBlobs preset="corners" />
      <h1 className="text-3xl font-medium text-gt-teal-800">Crédits photos</h1>
      <p className="mt-3 text-gt-teal-900/75">
        Les photos des circuits proviennent de Wikimedia Commons et sont publiées sous licence
        libre. Elles illustrent des paysages de Madagascar.
      </p>

      <ul className="mt-8 divide-y divide-gt-mist/70 rounded-3xl bg-white/80 px-5 ring-1 ring-gt-mist/60 backdrop-blur">
        {credits.map(([chemin, c]) => (
          <li key={chemin} className="py-4">
            <p className="font-medium text-gt-teal-900">{c.sujet}</p>
            <p className="mt-1 text-sm text-gt-teal-900/70">
              {c.auteur} ·{" "}
              {c.licenceUrl ? (
                <a href={c.licenceUrl} className="underline" rel="noreferrer" target="_blank">
                  {c.licence}
                </a>
              ) : (
                c.licence
              )}
              {c.source ? (
                <>
                  {" "}
                  ·{" "}
                  <a href={c.source} className="underline" rel="noreferrer" target="_blank">
                    source (Wikimedia Commons)
                  </a>
                </>
              ) : null}
            </p>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-xl font-medium text-gt-teal-800">Autres photos du site</h2>
      <p className="mt-2 text-sm text-gt-teal-900/70">
        Photos de l&apos;accueil et des partenaires : crédits en cours de vérification.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gt-teal-900/75">
        {PHOTOS_FOURNIES.map((p) => (
          <li key={p.chemin}>{p.sujet}</li>
        ))}
      </ul>
    </div>
  );
}
