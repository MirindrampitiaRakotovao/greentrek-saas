import type { ComponentProps } from "react";

type CheckboxFieldProps = Omit<ComponentProps<"input">, "type"> & { label: string };

/** Case à cocher avec son libellé cliquable. */
export function CheckboxField({ label, id, name, value, className, ...props }: CheckboxFieldProps) {
  const fieldId = id ?? (value !== undefined ? `${name}-${String(value)}` : name);
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <input
        id={fieldId}
        name={name}
        value={value}
        type="checkbox"
        className="size-4 rounded border-gt-mist accent-gt-teal-700"
        {...props}
      />
      <label htmlFor={fieldId} className="text-sm text-gt-teal-900">
        {label}
      </label>
    </div>
  );
}
