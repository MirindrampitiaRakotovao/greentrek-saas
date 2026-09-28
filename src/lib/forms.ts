import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

/** Reporte sur les champs du formulaire les erreurs renvoyées par une action serveur. */
export function applyFieldErrors<T extends FieldValues>(
  fieldErrors: Partial<Record<string, string>> | undefined,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): void {
  for (const field of fields) {
    const message = fieldErrors?.[field];
    if (message) setError(field, { message });
  }
}
