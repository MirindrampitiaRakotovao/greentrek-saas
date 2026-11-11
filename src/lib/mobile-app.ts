/**
 * Lien de téléchargement de l'application mobile (fichier APK Android, par exemple déposé sur
 * Google Drive pour la démonstration), lu dans `MOBILE_APP_URL`. Adresse http(s) seulement ;
 * sinon `null`, et l'encart « Téléchargez l'application » n'est pas affiché.
 */
export function mobileAppUrl(
  value: string | undefined = process.env.MOBILE_APP_URL,
): string | null {
  const url = value?.trim();
  if (!url) return null;
  try {
    return ["http:", "https:"].includes(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}
