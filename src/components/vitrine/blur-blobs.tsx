/**
 * Cercles flous décoratifs (demande de l'étudiant) : halos de couleur très diffus derrière le
 * contenu d'une section, aux couleurs de la palette (§8.2). Purement décoratifs (`aria-hidden`,
 * aucun clic intercepté). La section parente doit être `relative isolate` ; le `<main>` du
 * site coupe ce qui dépasse horizontalement (`overflow-x-clip`), sans barre de défilement.
 */
const TONES = {
  teal: "bg-gt-teal-200/70",
  sky: "bg-gt-sky/45",
  sand: "bg-gt-sand-300/55",
  cream: "bg-gt-cream",
} as const;

type Blob = {
  tone: keyof typeof TONES;
  /** Classes de position et de taille, ex. « -top-24 -left-20 size-80 ». */
  className: string;
};

const PRESETS: Record<"left" | "right" | "both" | "corners", readonly Blob[]> = {
  left: [
    { tone: "teal", className: "-top-16 -left-40 size-96" },
    { tone: "sand", className: "bottom-0 left-1/4 size-64" },
  ],
  right: [
    { tone: "sky", className: "-top-10 -right-40 size-96" },
    { tone: "sand", className: "-bottom-20 right-1/4 size-72" },
  ],
  both: [
    { tone: "teal", className: "top-10 -left-48 size-96" },
    { tone: "sand", className: "-right-32 bottom-0 size-80" },
  ],
  corners: [
    { tone: "sky", className: "-top-24 -left-24 size-80" },
    { tone: "teal", className: "top-1/3 -right-40 size-96" },
    { tone: "sand", className: "-bottom-24 left-1/3 size-72" },
  ],
};

export function BlurBlobs({ preset = "both" }: { preset?: keyof typeof PRESETS }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      {PRESETS[preset].map((blob, index) => (
        <span
          key={index}
          className={`absolute rounded-full blur-3xl ${TONES[blob.tone]} ${blob.className}`}
        />
      ))}
    </div>
  );
}
