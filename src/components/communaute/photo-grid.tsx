/**
 * Photos d'une publication. Dans le fil, une mosaïque recadrée ; sur la fiche
 * (`entieres`), chaque photo en entier, sans recadrage.
 */
export function PhotoGrid({
  photos,
  alt,
  entieres = false,
}: {
  photos: string[];
  alt: string;
  entieres?: boolean;
}) {
  if (entieres) {
    return (
      <div className="space-y-2">
        {photos.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- images envoyées, déjà réduites
          <img
            key={src}
            src={src}
            alt={`${alt} (photo ${i + 1} sur ${photos.length})`}
            loading={i === 0 ? "eager" : "lazy"}
            className="mx-auto max-h-[80vh] w-auto rounded-2xl bg-gt-mist/40 object-contain"
          />
        ))}
      </div>
    );
  }
  const one = photos.length === 1;
  return (
    <div className={`grid gap-1 overflow-hidden rounded-2xl ${one ? "" : "grid-cols-2"}`}>
      {photos.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- images envoyées, déjà réduites
        <img
          key={src}
          src={src}
          alt={`${alt} (photo ${i + 1} sur ${photos.length})`}
          loading="lazy"
          className={`w-full bg-gt-mist/40 object-cover ${
            one
              ? "aspect-[4/3]"
              : photos.length === 3 && i === 0
                ? "col-span-2 aspect-[2/1]"
                : "aspect-square"
          }`}
        />
      ))}
    </div>
  );
}
