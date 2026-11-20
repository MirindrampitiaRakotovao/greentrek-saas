/**
 * Thème clair ou sombre de la plateforme SaaS (étape 7, demande de l'étudiant) : seulement
 * dans les espaces connectés (back-office, console super admin, espace voyageur) ; le site
 * public (accueil, tarifs, site vitrine, connexion, facture) reste toujours clair.
 *
 * Comme l'application mobile : thème du système par défaut, ou choix « Clair » / « Sombre »
 * mémorisé dans le navigateur. Le script ci-dessous s'exécute dans le <head>, AVANT
 * l'affichage (pas d'éclair blanc) : il pose sur <html>
 *  - `data-theme="light" | "dark"` (thème appliqué),
 *  - la classe `gt-app` dans un espace connecté (la couche sombre `dark.css` ne s'applique
 *    qu'avec elle ; la coque `AppShell` la tient à jour lors des navigations).
 * Il suit en direct un changement de thème du système.
 */

export const THEME_STORAGE_KEY = "greentrek.theme";
export type ThemePreference = "system" | "light" | "dark";
export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

/** Espaces connectés (même règle que le proxy). */
export const APP_PATH_PATTERN = "^/(dashboard|admin)(/|$)|^/a/[^/]+/mon-compte(/|$)";

export function isAppPath(pathname: string): boolean {
  return new RegExp(APP_PATH_PATTERN).test(pathname);
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): "light" | "dark" {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

/** Script du <head> (chaîne autonome : aucune dépendance, erreurs ignorées). */
export const THEME_SCRIPT = `(function(){try{
var d=document.documentElement,k=${JSON.stringify(THEME_STORAGE_KEY)},m=window.matchMedia("(prefers-color-scheme: dark)");
function pref(){try{var v=localStorage.getItem(k);return v==="light"||v==="dark"?v:"system";}catch(e){return "system";}}
function apply(){var p=pref();d.setAttribute("data-theme",p==="system"?(m.matches?"dark":"light"):p);d.setAttribute("data-theme-pref",p);}
if(new RegExp(${JSON.stringify(APP_PATH_PATTERN)}).test(location.pathname))d.classList.add("gt-app");
apply();m.addEventListener("change",apply);window.__gtApplyTheme=apply;
}catch(e){}})();`;
