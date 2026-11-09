/**
 * Palette et polices de l'application, reprises du site (cahier des charges §8.2 ; Nohemi pour
 * les titres, Poppins pour le texte, Dancing Script pour les accroches manuscrites).
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

export const radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 } as const;
