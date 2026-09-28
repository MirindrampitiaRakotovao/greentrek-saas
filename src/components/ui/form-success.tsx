/** Message de confirmation d'un formulaire, annoncé poliment aux lecteurs d'écran. */
export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
    >
      {message}
    </p>
  );
}
