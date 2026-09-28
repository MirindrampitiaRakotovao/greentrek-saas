import type { ComponentProps } from "react";

type TextareaFieldProps = ComponentProps<"textarea"> & {
  label: string;
  error?: string;
  hint?: string;
};

/** Zone de texte accessible, compatible avec `register` de React Hook Form. */
export function TextareaField({
  label,
  error,
  hint,
  id,
  name,
  className,
  rows = 4,
  ...props
}: TextareaFieldProps) {
  const fieldId = id ?? name;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="block text-sm font-medium text-gt-teal-900">
        {label}
      </label>
      <textarea
        id={fieldId}
        name={name}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="mt-1 block w-full rounded-lg border border-gt-mist bg-white px-3 py-2 text-gt-teal-900 shadow-sm outline-none focus:border-gt-teal-600 focus:ring-2 focus:ring-gt-teal-500/30 aria-invalid:border-red-600"
        {...props}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="mt-1 text-sm text-gt-teal-900/70">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
