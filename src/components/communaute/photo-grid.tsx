import Link from "next/link";

import { creditFor } from "@/lib/photo-credits";

/**
 * Photos d'une publication.
 * - Fil : mosaïque (une grande photo, jusqu'à quatre petites, « +N » sur la dernière), liée à
 *   la fiche de la publication.
 * - Fiche (`entieres`) : chaque photo en entier, sans recadrage, avec son crédit s'il s'agit
 *   d'une photo libre livrée avec le projet (licences CC BY et BY-SA : attribution).
 */
export function PhotoGrid({
  photos,
  alt,
  entieres = false,
  href,
}: {
  photos: string[];
  alt: string;
  entieres?: boolean;
  href?: string;
}) {
  const label = (i: number) => `${alt} (photo ${i + 1} sur ${photos.length})`;
  if (entieres) {
    return (
      <div className="space-y-4">
        {photos.map((src, i) => {
          const credit = creditFor(src);
          return (
            <figure key={src} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- images réduites */}
              <img
                src={src}
                alt={label(i)}
                loading={i === 0 ? "eager" : "lazy"}
                className="mx-auto max-h-[80vh] w-auto rounded-2xl bg-gt-mist/40 object-contain"
              />
              {credit ? (
                <figcaption className="text-center text-[11px] text-gt-teal-900/70">
                  {credit.sujet} · {credit.auteur} ·{" "}
                  {credit.source ? (
                    <a href={credit.source} className="underline" rel="noopener noreferrer">
                      {credit.licence}
                    </a>
                  ) : (
                    credit.licence
                  )}
                </figcaption>
              ) : null}
            </figure>
          );
        })}
      </div>
    );
  }

  const shown = photos.slice(0, 5);
  const reste = photos.length - shown.length;
  const small = shown.slice(1);
  // Petites photos : 1 → pleine hauteur, 2 → empilées, 3 → deux puis une large, 4 → 2 × 2.
  const smallClass = (k: number) =>
    small.length === 1
      ? "col-span-2 row-span-2"
      : small.length === 2
        ? "col-span-2"
        : small.length === 3 && k === 2
          ? "col-span-2"
          : "";
  const grid = (
    <div
      className={`grid gap-1.5 overflow-hidden rounded-2xl ${
        shown.length === 1 ? "" : "aspect-[16/10] grid-cols-4 grid-rows-2"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- images réduites */}
      <img
        src={shown[0]}
        alt={label(0)}
        loading="lazy"
        className={`h-full w-full bg-gt-mist/40 object-cover ${
          shown.length === 1 ? "aspect-[16/10]" : "col-span-2 row-span-2"
        }`}
      />
      {small.map((src, k) => (
        <div key={src} className={`relative min-h-0 ${smallClass(k)}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- images réduites */}
          <img
            src={src}
            alt={label(k + 1)}
            loading="lazy"
            className="h-full w-full bg-gt-mist/40 object-cover"
          />
          {reste > 0 && k === small.length - 1 ? (
            <span className="absolute inset-0 flex items-center justify-center bg-gt-teal-900/55 text-2xl font-semibold text-white">
              +{reste}
              <span className="sr-only"> autres photos</span>
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
  return href ? (
    <Link
      href={href}
      className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {grid}
    </Link>
  ) : (
    grid
  );
}
