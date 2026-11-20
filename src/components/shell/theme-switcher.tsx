"use client";

import { useSyncExternalStore } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

/**
 * Choix du thème des espaces connectés (étape 7), comme dans l'application mobile :
 * « Système » (par défaut), « Clair » ou « Sombre », mémorisé dans le navigateur. Le script
 * du <head> (src/lib/theme.ts) applique le choix et suit le thème du système.
 */

const OPTIONS: { value: ThemePreference; label: string; icon: IconName }[] = [
  { value: "system", label: "Thème du système", icon: "monitor" },
  { value: "light", label: "Thème clair", icon: "sun" },
  { value: "dark", label: "Thème sombre", icon: "moon" },
];

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  const value = document.documentElement.getAttribute("data-theme-pref");
  return value === "light" || value === "dark" ? value : "system";
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function choose(value: ThemePreference) {
  try {
    if (value === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // Navigation privée sans stockage : le choix vaut pour la page en cours seulement.
  }
  const apply = (window as { __gtApplyTheme?: () => void }).__gtApplyTheme;
  if (apply) apply();
  else document.documentElement.setAttribute("data-theme-pref", value);
  listeners.forEach((listener) => listener());
}

export function ThemeSwitcher() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as const);
  return (
    <div
      role="group"
      aria-label="Thème de l'affichage"
      className="gt-theme-switch flex items-center gap-0.5 rounded-full border border-gt-mist bg-white p-0.5"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => choose(option.value)}
          aria-pressed={preference === option.value}
          title={option.label}
          className={`grid size-8 place-items-center rounded-full transition-colors ${
            preference === option.value
              ? "gt-theme-switch__on bg-gt-teal-700 text-white"
              : "text-gt-teal-900/75 hover:text-gt-teal-900"
          }`}
        >
          <Icon name={option.icon} className="size-4" />
          <span className="sr-only">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
