import type { ComponentProps } from "react";

type SelectFieldProps = ComponentProps<"select"> & {
  label: string;
  options: readonly { value: string; label: string }[];
  error?: string;
};

/** Liste déroulante accessible, compatible avec `register` de React Hook Form. */
export function SelectField({
  label,
  options,
  error,
  id,
  name,
  className,
  ...props
}: SelectFieldProps) {
  const selectId = id ?? name;
  return (
    <div className={className}>
      <label htmlFor={selectId} className="block text-sm font-medium text-gt-teal-900">
        {label}
      </label>
      <select
        id={selectId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-error` : undefined}
        className="mt-1 block w-full rounded-lg border border-gt-mist bg-white px-3 py-2 text-gt-teal-900 shadow-sm outline-none focus:border-gt-teal-600 focus:ring-2 focus:ring-gt-teal-500/30 aria-invalid:border-red-600"
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={`${selectId}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
