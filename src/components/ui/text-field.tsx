import type { ComponentProps } from "react";

type TextFieldProps = ComponentProps<"input"> & {
  label: string;
  error?: string;
  hint?: string;
};

/**
 * Champ de formulaire accessible : libellé relié au champ, message d'erreur annoncé
 * (`aria-invalid`, `aria-describedby`). Compatible avec `register` de React Hook Form
 * (en React 19, `ref` est une prop comme les autres).
 */
export function TextField({ label, error, hint, id, name, className, ...props }: TextFieldProps) {
  const inputId = id ?? name;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-sm font-medium text-gt-teal-900">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="mt-1 block w-full rounded-lg border border-gt-mist bg-white px-3 py-2 text-gt-teal-900 shadow-sm outline-none focus:border-gt-teal-600 focus:ring-2 focus:ring-gt-teal-500/30 aria-invalid:border-red-600"
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1 text-sm text-gt-teal-900/70">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
