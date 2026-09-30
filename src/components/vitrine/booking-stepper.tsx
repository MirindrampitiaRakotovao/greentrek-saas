/** Étapes du tunnel de réservation (§7.2), affichées en haut de chaque écran. */
export const BOOKING_STEPS = ["Voyageurs", "Participants", "Récapitulatif", "Paiement"] as const;

export function BookingStepper({ current }: { current: number }) {
  return (
    <ol
      className="flex items-center gap-2 text-xs sm:text-sm"
      aria-label="Étapes de la réservation"
    >
      {BOOKING_STEPS.map((label, index) => {
        const state = index < current ? "done" : index === current ? "current" : "todo";
        return (
          <li
            key={label}
            aria-current={state === "current" ? "step" : undefined}
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                state === "todo"
                  ? "bg-gt-teal-50 text-gt-teal-900/75 ring-1 ring-gt-mist"
                  : "bg-gt-teal-700 text-white"
              }`}
            >
              {state === "done" ? "✓" : index + 1}
            </span>
            <span
              className={`truncate ${state === "current" ? "font-semibold text-gt-teal-900" : "text-gt-teal-900/75"} ${state === "current" ? "" : "hidden sm:inline"}`}
            >
              {label}
            </span>
            {index < BOOKING_STEPS.length - 1 ? (
              <span aria-hidden="true" className="h-px flex-1 bg-gt-mist" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
