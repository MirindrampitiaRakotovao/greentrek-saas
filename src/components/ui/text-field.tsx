import type { ComponentProps, ReactNode } from "react";

type TextFieldProps = ComponentProps<"input"> & {
  label: string;
  error?: string;
  hint?: string;
  /**
   * « standard » : libellé au-dessus du champ (back-office). « encadre » : libellé posé dans
   * la bordure, champ plus haut (pages de connexion et d'inscription).
   */
  appearance?: "standard" | "encadre";
  /** Élément placé à droite, dans le champ (ex. bouton « afficher le mot de passe »). */
  trailing?: ReactNode;
};

/**
 * Champ de formulaire accessible : libellé relié au champ, message d'erreur annoncé
 * (`aria-invalid`, `aria-describedby`). Compatible avec `register` de React Hook Form
 * (en React 19, `ref` est une prop comme les autres).
 */
export function TextField({
  label,
  error,
  hint,
  id,
  name,
  className,
  appearance = "standard",
  trailing,
  ...props
}: TextFieldProps) {
  const inputId = id ?? name;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  const encadre = appearance === "encadre";

  return (
    <div className={className}>
      <div className={encadre ? "relative" : undefined}>
        <label
          htmlFor={inputId}
          className={
            encadre
              ? "absolute -top-2.5 left-3 z-10 bg-white px-1.5 text-sm text-gt-teal-900/75"
              : "block text-sm font-medium text-gt-teal-900"
          }
        >
          {label}
        </label>
        <div className={`relative ${encadre ? "" : "mt-1"}`}>
          <input
            id={inputId}
            name={name}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`block w-full border bg-white text-gt-teal-900 outline-none focus:border-gt-teal-600 focus:ring-2 focus:ring-gt-teal-500/30 aria-invalid:border-red-600 ${
              encadre
                ? "h-14 rounded-xl border-gt-sky/70 px-4 text-base"
                : "rounded-lg border-gt-mist px-3 py-2 shadow-sm"
            } ${trailing ? "pr-12" : ""}`}
            {...props}
          />
          {trailing ? (
            <div className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</div>
          ) : null}
        </div>
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1 text-sm text-gt-teal-900/75">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
