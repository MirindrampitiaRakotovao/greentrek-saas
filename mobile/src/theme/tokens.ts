/**
 * Palette et polices de l'application, reprises du site (cahier des charges §8.2 ; Nohemi pour
 * les titres, Poppins pour le texte, Dancing Script pour les accroches manuscrites).
 *
 * Refonte « verre dépoli » (après E12, demande de l'étudiant) : deux thèmes, clair et sombre,
 * construits sur la même palette. Accent : le sable de Green Trek (et non le vert citron de la
 * maquette d'inspiration). Les contrastes texte / fond de chaque thème sont vérifiés par un
 * test (`tests/unit/mobile-theme.test.ts`). Fichier sans dépendance à React Native.
 */
export const colors = {
  teal500: "#0D8495",
  teal600: "#1C7482",
  teal700: "#0F6775",
  teal800: "#025E69",
  teal900: "#0F414D",
  tealCard: "#10585B",
  teal50: "#F2F8F8",
  teal100: "#DCEFEF",
  sand300: "#FAD594",
  sand200: "#EFD7A3",
  cream: "#EFE8DD",
  mist: "#D1D9DA",
  canvas: "#EEF3F3",
  white: "#FFFFFF",
  star: "#D99A1E",
  /** Texte secondaire : teal-900 à 75 % d'opacité (contraste ≥ 4,5:1 sur blanc). */
  muted: "rgba(15, 65, 77, 0.75)",
  danger: "#B42318",
} as const;

export type Theme = {
  dark: boolean;
  /** Fond des écrans. */
  bg: string;
  /** Cartes pleines (listes, formulaires). */
  surface: string;
  /** Champs de saisie, pastilles neutres. */
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  /** Bouton principal et son texte. */
  primary: string;
  onPrimary: string;
  /** Mise en avant (onglet actif, icônes actives, liens). */
  accent: string;
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  success: string;
  star: string;
  /** Verre dépoli : teinte du flou (iOS), remplissage translucide, liseré. */
  glass: {
    tint: "systemThinMaterialLight" | "systemThinMaterialDark";
    /** Remplissage par-dessus le flou (iOS) ou seul (Android, sans flou). */
    fill: string;
    fillSolid: string;
    border: string;
  };
  /** Voile des photos (le texte posé sur une photo est toujours blanc). */
  scrim: string;
};

export const lightTheme: Theme = {
  dark: false,
  bg: "#F2F5F5",
  surface: "#FFFFFF",
  surfaceAlt: "#E8EFEF",
  text: "#0F414D",
  textMuted: "rgba(15, 65, 77, 0.74)",
  border: "rgba(15, 65, 77, 0.12)",
  primary: "#0F414D",
  onPrimary: "#FFFFFF",
  accent: "#0F6775",
  accentSoft: "rgba(15, 103, 117, 0.10)",
  danger: "#B42318",
  dangerSoft: "#FEF3F2",
  success: "#0F6775",
  star: "#B7791F",
  glass: {
    tint: "systemThinMaterialLight",
    fill: "rgba(255, 255, 255, 0.55)",
    fillSolid: "rgba(255, 255, 255, 0.86)",
    border: "rgba(255, 255, 255, 0.75)",
  },
  scrim: "rgba(6, 26, 31, 0.55)",
};

export const darkTheme: Theme = {
  dark: true,
  bg: "#061A1F",
  surface: "#0E2A31",
  surfaceAlt: "#15363E",
  text: "#EAF3F2",
  textMuted: "rgba(234, 243, 242, 0.72)",
  border: "rgba(255, 255, 255, 0.10)",
  primary: "#FAD594",
  onPrimary: "#0F414D",
  accent: "#FAD594",
  accentSoft: "rgba(250, 213, 148, 0.14)",
  danger: "#FDA29B",
  dangerSoft: "rgba(253, 162, 155, 0.12)",
  success: "#7FD1C9",
  star: "#FAD594",
  glass: {
    tint: "systemThinMaterialDark",
    fill: "rgba(8, 30, 36, 0.45)",
    fillSolid: "rgba(10, 36, 43, 0.84)",
    border: "rgba(255, 255, 255, 0.14)",
  },
  scrim: "rgba(3, 14, 17, 0.62)",
};

export const fonts = {
  display: "Nohemi-Bold",
  displayMedium: "Nohemi-Medium",
  text: "Poppins_400Regular",
  textMedium: "Poppins_500Medium",
  textSemiBold: "Poppins_600SemiBold",
  script: "DancingScript_700Bold",
} as const;

/** Couleurs des catégories de difficulté (pastilles rondes de l'accueil, d'après la maquette). */
export const difficultyColors = {
  FACILE: "#0D8495",
  MOYENNE: "#E0A526",
  DIFFICILE: "#2C6E9B",
  PROCHE: "#7B5BB5",
} as const;

export const radius = { sm: 12, md: 20, lg: 28, xl: 36, pill: 999 } as const;

/** Préférence d'apparence choisie dans l'onglet Compte. */
export type ThemePreference = "system" | "light" | "dark";

export function resolveTheme(
  preference: ThemePreference,
  system: "light" | "dark" | null | undefined,
): Theme {
  const scheme = preference === "system" ? (system ?? "light") : preference;
  return scheme === "dark" ? darkTheme : lightTheme;
}

/** Couleurs de chaque statut, en clair et en sombre (contraste ≥ 4,5:1, testé). */
export const STATUS_COLORS: Record<
  "light" | "dark",
  Record<"EN_ATTENTE" | "CONFIRMEE" | "ANNULEE" | "TERMINEE", { bg: string; fg: string }>
> = {
  light: {
    EN_ATTENTE: { bg: "#FBEBC8", fg: "#6B4A06" },
    CONFIRMEE: { bg: "#D1FADF", fg: "#05603A" },
    ANNULEE: { bg: "#E4E9EA", fg: "#0F414D" },
    TERMINEE: { bg: "#DCEFEF", fg: "#025E69" },
  },
  dark: {
    EN_ATTENTE: { bg: "rgba(250, 213, 148, 0.16)", fg: "#FAD594" },
    CONFIRMEE: { bg: "rgba(110, 231, 183, 0.14)", fg: "#86EFAC" },
    ANNULEE: { bg: "rgba(255, 255, 255, 0.10)", fg: "#D1D9DA" },
    TERMINEE: { bg: "rgba(127, 209, 201, 0.14)", fg: "#99E0D9" },
  },
};
