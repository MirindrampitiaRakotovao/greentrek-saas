/**
 * Transforme un libellé en identifiant d'URL : « Green Trek Mada » → « green-trek-mada ».
 * Les accents sont retirés (décomposition Unicode NFD puis suppression des diacritiques).
 */
export function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/, "");
}
