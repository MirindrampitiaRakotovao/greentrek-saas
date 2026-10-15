/**
 * Titre de section du site vitrine et de l'accueil de la plateforme, dans le style du hero :
 * mot manuscrit en accent, posé sur un grand titre. `tone="dark"` sur fond sombre (titre en
 * dégradé blanc), `light` sur fond clair.
 */
export function SectionHeading({
  id,
  accent,
  title,
  tone = "light",
  align = "left",
  children,
}: {
  id?: string;
  accent?: string;
  title: string;
  tone?: "light" | "dark";
  align?: "left" | "center";
  /** Texte d'introduction sous le titre. */
  children?: React.ReactNode;
}) {
  const dark = tone === "dark";
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {accent ? (
        <p
          aria-hidden="true"
          className={`relative z-10 -mb-2 inline-block -rotate-3 font-script text-3xl sm:text-4xl ${
            dark ? "text-gt-sand-300" : "text-gt-teal-600"
          }`}
        >
          {accent}
        </p>
      ) : null}
      <h2
        id={id}
        className={`font-display text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl ${
          dark
            ? "bg-linear-to-b from-white to-white/70 bg-clip-text text-transparent"
            : "text-gt-teal-900"
        }`}
      >
        {title}
      </h2>
      {children ? (
        <div className={`mt-4 leading-relaxed ${dark ? "text-white/85" : "text-gt-teal-900/75"}`}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
