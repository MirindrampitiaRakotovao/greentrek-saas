import Image from "next/image";

/**
 * Logo de Green Trek (fourni par l'entreprise) : symbole seul (montagnes, sentier, baobab)
 * ou logo complet avec le nom, en couleur ou en blanc (fonds sombres). Fichiers dans
 * `public/logo/`, dimensions d'origine indiquées pour éviter tout décalage au chargement.
 */
const FILES = {
  symbole: {
    couleur: "/logo/green-trek-symbole.png",
    blanc: "/logo/green-trek-symbole-blanc.png",
    width: 1136,
    height: 615,
  },
  complet: {
    couleur: "/logo/green-trek.png",
    blanc: "/logo/green-trek-blanc.png",
    width: 1136,
    height: 751,
  },
} as const;

export function Logo({
  variant = "symbole",
  tone = "couleur",
  className = "h-9 w-auto",
  alt = "",
  priority = false,
}: {
  variant?: keyof typeof FILES;
  tone?: "couleur" | "blanc";
  className?: string;
  /** Vide quand le nom « Green Trek » est écrit juste à côté (logo décoratif). */
  alt?: string;
  priority?: boolean;
}) {
  const file = FILES[variant];
  return (
    <Image
      src={file[tone]}
      alt={alt}
      width={file.width}
      height={file.height}
      priority={priority}
      sizes="160px"
      className={`shrink-0 ${className}`}
    />
  );
}
