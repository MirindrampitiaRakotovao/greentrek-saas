/**
 * Export CSV (§7.6, P2) lisible par Excel en français : séparateur « ; » (la virgule y est le
 * séparateur décimal), guillemets doublés, champs contenant ; " ou un retour à la ligne
 * entourés de guillemets. Le BOM UTF-8 (accents) est ajouté par la route qui sert le fichier.
 *
 * Injection de formule : une cellule commençant par = + - @ serait exécutée par le tableur
 * (ex. un nom de client « =HYPERLINK(…) ») ; on la préfixe d'une apostrophe.
 */
export type CsvValue = string | number | null | undefined;

function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(";")).join("\r\n");
}
