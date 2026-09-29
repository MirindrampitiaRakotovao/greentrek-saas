import Image from "next/image";

/**
 * Visuel dessiné d'un circuit, affiché tant que l'agence n'a pas fourni de photo.
 * TODO(photos Green Trek) : remplacer par des photos de l'agence (décision A de l'étape E8) ;
 * une photo renseignée dans « Image principale » du circuit est prioritaire.
 *
 * Trois paysages (sentier de montagne, côte et pirogue, village), choisis de façon stable
 * à partir d'une clé (slug du circuit) : un même circuit garde toujours le même visuel.
 * Illustration purement décorative : `aria-hidden`, le titre du circuit porte le sens.
 */
export type Landscape = "sentier" | "cote" | "village";

const LANDSCAPES: readonly Landscape[] = ["sentier", "cote", "village"];

export function landscapeFor(key: string): Landscape {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return LANDSCAPES[hash % LANDSCAPES.length] ?? "sentier";
}

export function CircuitVisual({
  imageUrl,
  landscapeKey,
  landscape,
  sizes = "(min-width: 1024px) 400px, 90vw",
  priority = false,
  className = "",
}: {
  imageUrl?: string | null;
  landscapeKey?: string;
  landscape?: Landscape;
  /** Largeur d'affichage, pour que `next/image` serve une version adaptée. */
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  if (imageUrl?.startsWith("/images/")) {
    // Photo livrée avec l'application : optimisée par Next.js (formats modernes, tailles).
    // Le parent doit être positionné (`relative` ou `absolute`).
    return (
      <Image
        src={imageUrl}
        alt=""
        fill
        sizes={sizes}
        priority={priority}
        className={`object-cover ${className}`}
      />
    );
  }
  if (imageUrl) {
    // Adresse saisie par l'agence : image externe non optimisée par Next.js.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt="" className={`object-cover ${className}`} />;
  }
  const kind = landscape ?? landscapeFor(landscapeKey ?? "");
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 260"
      preserveAspectRatio="xMidYMid slice"
      className={className}
    >
      <rect width="400" height="260" fill="#96beca" />
      <rect y="95" width="400" height="165" fill="#b8dfe2" />
      <rect y="135" width="400" height="125" fill="#efe8dd" />
      <circle cx="318" cy="62" r="26" fill="#fad594" />
      {kind === "sentier" ? (
        <>
          <path
            d="M0 170 L70 95 L130 150 L210 70 L300 160 L350 120 L400 150 V260 H0Z"
            fill="#1c7482"
          />
          <path d="M0 200 L90 150 L170 190 L260 140 L400 195 V260 H0Z" fill="#0f6775" />
          <path d="M0 235 Q120 205 220 225 T400 220 V260 H0Z" fill="#0f414d" />
          <path
            d="M150 260 C170 235 210 232 205 215 S250 200 262 188"
            fill="none"
            stroke="#efd7a3"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="2 10"
          />
        </>
      ) : null}
      {kind === "cote" ? (
        <>
          <path d="M0 150 Q60 120 120 140 T230 135 L230 160 H0Z" fill="#1c7482" />
          <rect y="155" width="400" height="105" fill="#0d8495" />
          <path
            d="M0 185 Q50 175 100 185 T200 185 T300 185 T400 185"
            fill="none"
            stroke="#b8dfe2"
            strokeWidth="3"
          />
          <path
            d="M0 215 Q50 205 100 215 T200 215 T300 215 T400 215"
            fill="none"
            stroke="#b8dfe2"
            strokeWidth="3"
          />
          <path d="M150 196 Q200 212 262 196 L252 206 Q200 218 160 206Z" fill="#0f414d" />
          <path d="M210 150 V198" stroke="#0f414d" strokeWidth="3" />
          <path d="M296 160 Q340 140 400 150 V260 H330 Q300 220 296 160Z" fill="#efd7a3" />
        </>
      ) : null}
      {kind === "village" ? (
        <>
          <path d="M0 175 Q100 130 200 165 T400 150 V260 H0Z" fill="#1c7482" />
          <path d="M0 215 Q120 185 240 210 T400 205 V260 H0Z" fill="#0f6775" />
          {[70, 150, 250].map((x, i) => (
            <g key={x} transform={`translate(${x} ${178 + (i % 2) * 8})`}>
              <rect x="-22" y="0" width="44" height="30" fill="#efd7a3" />
              <path d="M-30 2 L0 -26 L30 2Z" fill="#c98a1b" />
              <rect x="-6" y="12" width="12" height="18" fill="#0f414d" />
            </g>
          ))}
          <path d="M335 215 V150" stroke="#0f414d" strokeWidth="4" />
          <path
            d="M335 150 q-30 -5 -45 12 M335 150 q30 -5 45 12 M335 150 q-20 -22 -40 -20 M335 150 q20 -22 40 -20"
            fill="none"
            stroke="#0f414d"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </>
      ) : null}
    </svg>
  );
}
