/**
 * Bord « coup de pinceau » (trait de style de la maquette, §8.4) : bande irrégulière posée
 * sur le bas (ou le haut) d'une section photo, de la couleur de la section suivante.
 * Le contour est calculé une fois, de façon déterministe (même rendu serveur et navigateur).
 */
const WIDTH = 1200;
const HEIGHT = 60;

function brushPath(): string {
  const steps = 80;
  const points: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const x = (i * WIDTH) / steps;
    // Somme de sinus de périodes différentes + petites « soies » : contour irrégulier.
    const y =
      30 +
      9 * Math.sin(i * 0.37) +
      5 * Math.sin(i * 1.9) +
      (i % 4 === 0 ? 6 : 0) -
      (i % 7 === 0 ? 5 : 0);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M0,${HEIGHT} L${points.join(" L")} L${WIDTH},${HEIGHT} Z`;
}

const PATH = brushPath();

export function BrushEdge({
  position = "bottom",
  className = "fill-white",
}: {
  position?: "bottom" | "top";
  /** Couleur (classe `fill-…`) : celle de la section adjacente. */
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-x-0 h-8 w-full sm:h-12 ${
        position === "bottom" ? "-bottom-px" : "-top-px rotate-180"
      } ${className}`}
    >
      <path d={PATH} />
    </svg>
  );
}
