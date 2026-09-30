const STAR = "m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z";

function StarShape({ fill, className }: { fill: number; className: string }) {
  // `fill` entre 0 et 1 : étoile pleine, partielle (demi-note) ou vide.
  const pct = Math.round(Math.max(0, Math.min(1, fill)) * 100);
  return (
    <span className={`relative inline-block ${className}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" className="absolute inset-0 size-full text-gt-mist">
        <path d={STAR} fill="currentColor" />
      </svg>
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
        <svg viewBox="0 0 24 24" className={`h-full text-gt-star ${className}`}>
          <path d={STAR} fill="currentColor" />
        </svg>
      </span>
    </span>
  );
}

/**
 * Affichage d'une note sur 5 (avis, étape E12). Les étoiles sont décoratives : la note est
 * toujours donnée en texte (visible ou pour les lecteurs d'écran), jamais par la couleur seule.
 */
export function Stars({
  note,
  nombre,
  size = "sm",
  showValue = true,
  onDark = false,
}: {
  note: number;
  /** Nombre d'avis (affiché entre parenthèses). */
  nombre?: number;
  size?: "sm" | "md";
  showValue?: boolean;
  /** Sur fond sombre (photo du circuit) : texte blanc. */
  onDark?: boolean;
}) {
  const star = size === "md" ? "size-5" : "size-4";
  const valeur = note.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  const libelle = `Note : ${valeur} sur 5${nombre !== undefined ? `, ${nombre} avis` : ""}`;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex" role="img" aria-label={libelle}>
        {[0, 1, 2, 3, 4].map((i) => (
          <StarShape key={i} fill={note - i} className={star} />
        ))}
      </span>
      {showValue ? (
        <span
          className={`text-sm font-medium ${onDark ? "text-white" : "text-gt-teal-900"}`}
          aria-hidden="true"
        >
          {valeur}
          {nombre !== undefined ? (
            <span className={`font-normal ${onDark ? "text-white/85" : "text-gt-teal-900/75"}`}>
              {" "}
              ({nombre} avis)
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Saisie d'une note (1 à 5) : un groupe de boutons radio natifs, utilisable au clavier
 * (flèches) et annoncé par les lecteurs d'écran ; les étoiles n'en sont que l'habillage.
 */
export function StarInput({
  name,
  value,
  onChange,
  error,
}: {
  name: string;
  value: number;
  onChange: (note: number) => void;
  error?: string;
}) {
  const LABELS = ["Très décevant", "Décevant", "Correct", "Très bien", "Excellent"];
  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="text-sm font-medium text-gt-teal-900">Votre note</legend>
      <div className="mt-2 flex items-center gap-1">
        {LABELS.map((label, i) => {
          const note = i + 1;
          return (
            <label
              key={note}
              className="cursor-pointer rounded-md p-0.5 has-focus-visible:ring-2 has-focus-visible:ring-gt-teal-500"
            >
              <input
                type="radio"
                name={name}
                value={note}
                checked={value === note}
                onChange={() => onChange(note)}
                className="sr-only"
              />
              <span className="sr-only">
                {note} sur 5 : {label}
              </span>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className={`size-8 transition-colors ${note <= value ? "text-gt-star" : "text-gt-mist hover:text-gt-sand-300"}`}
              >
                <path d={STAR} fill="currentColor" />
              </svg>
            </label>
          );
        })}
        <span className="ml-2 text-sm text-gt-teal-900/80" aria-hidden="true">
          {value > 0 ? LABELS[value - 1] : ""}
        </span>
      </div>
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
