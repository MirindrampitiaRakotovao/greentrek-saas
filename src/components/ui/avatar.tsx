/**
 * Photo de profil ronde (après E12) : la photo envoyée par l'utilisateur, ou le logo de
 * l'agence pour l'équipe d'une agence, sinon les initiales. Décorative par défaut : le nom
 * est écrit à côté.
 */
export function Avatar({
  name,
  src,
  size = 40,
  className = "",
  label,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
  /** Texte alternatif quand l'avatar porte seul le sens (sinon décoratif). */
  label?: string;
}) {
  const style = { width: size, height: size };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- images envoyées, déjà réduites
      <img
        src={src}
        alt={label ?? ""}
        aria-hidden={label ? undefined : true}
        style={style}
        className={`shrink-0 rounded-full bg-white object-cover ring-2 ring-white ${className}`}
        loading="lazy"
      />
    );
  }
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ ...style, fontSize: Math.max(10, size * 0.36) }}
      className={`grid shrink-0 place-items-center rounded-full bg-gt-teal-700 font-semibold text-white ring-2 ring-white ${className}`}
    >
      {initials(name)}
    </span>
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
