/** Réponse d'une action serveur au formulaire qui l'a appelée. */
export type ActionResult = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
  success?: string;
};
