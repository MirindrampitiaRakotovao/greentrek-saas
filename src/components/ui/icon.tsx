/**
 * Pictogrammes fins et monochromes (§8.4), dessinés en traits de 1,75 px sur une grille de
 * 24 px. Décoratifs par défaut (`aria-hidden`) : le texte voisin porte le sens.
 */
const PATHS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  users:
    "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6m13 9v-1a4 4 0 0 0-3-3.87M16 4.13a3 3 0 0 1 0 5.74",
  user: "M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18m3.5-12.5-2 5-5 2 2-5z",
  handshake:
    "m11 17 2 2a1.4 1.4 0 0 0 2-2m-2-2 2.5 2.5a1.4 1.4 0 0 0 2-2l-3.9-3.9a2 2 0 0 0-2.8 0l-.9.9a1.4 1.4 0 0 1-2-2l2.8-2.8a4 4 0 0 1 4.9-.6l.5.3a3 3 0 0 0 2.2.4L21 6m0 8-3-3M3 6l2 .7a3 3 0 0 0 2.2-.3l.3-.2M3 13l6 6a1.4 1.4 0 0 0 2-2",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6m7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.2-1.3L14.3 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3",
  search: "m21 21-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9m4.3 13a1.9 1.9 0 0 0 3.4 0",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M18 6 6 18M6 6l12 12",
  calendar:
    "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2",
  ticket:
    "M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4m10-4v2m0 10v2m0-8v2",
  wallet:
    "M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v3m0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5m18 7h-4a2 2 0 0 0 0 4h4z",
  coins:
    "M9 14c-3.3 0-6-1.1-6-2.5S5.7 9 9 9s6 1.1 6 2.5M3 11.5v4C3 16.9 5.7 18 9 18s6-1.1 6-2.5v-4M9 5c3.3 0 6 1.1 6 2.5M15 12.5c3.3 0 6-1.1 6-2.5s-2.7-2.5-6-2.5M21 10v4c0 1.4-2.7 2.5-6 2.5",
  gauge: "M12 14l4-4M3.3 19a10 10 0 1 1 17.4 0",
  route:
    "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4m12-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4M6 15V9a4 4 0 0 1 4-4h4m-4 14h4a4 4 0 0 0 4-4V9",
  mountain: "m8 3 4 8 5-5 5 15H2z",
  building: "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18zm-4 0h20M10 6h4m-4 4h4m-4 4h4m-4 4h4",
  check: "M20 6 9 17l-5-5",
  xCircle: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20m3-13-6 6m0-6 6 6",
  arrowUp: "M12 19V5m-7 7 7-7 7 7",
  arrowDown: "M12 5v14m7-7-7 7-7-7",
  arrowRight: "M5 12h14m-7-7 7 7-7 7",
  sparkles:
    "m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10m-3-10 2 2 4-4",
  leaf: "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10m-9 1c0-3 1.9-5.4 5.1-6.4",
  crosshair: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20m10-10h-4M6 12H2m10-6V2m0 20v-4",
  copy: "M8 8h12v12H8zM4 16V4h12",
  external: "M15 3h6v6m-11 5L21 3m-3 10v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
  layers: "m12 2 10 5-10 5L2 7zm-10 10 10 5 10-5M2 17l10 5 10-5",
  plus: "M12 5v14m-7-7h14",
  minus: "M5 12h14",
  pencil: "M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z",
  trash:
    "M3 6h18m-2 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  pin: "M12 22s-7-6.2-7-12a7 7 0 1 1 14 0c0 5.8-7 12-7 12m0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  utensils:
    "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20m14-7V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2zm0 0v7",
  anchor: "M12 22V8m0 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6M5 12H2a10 10 0 0 0 20 0h-3",
  navigation: "M3 11 22 2l-9 19-2-8z",
  download: "M12 3v12m-5-5 5 5 5-5M4 21h16",
  play: "M6 4l14 8-14 8z",
  swap: "M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3",
  star: "m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z",
  message: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12m10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  eyeOff:
    "M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.4 3.3M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18",
  arrowLeft: "M19 12H5m6-7-7 7 7 7",
  send: "M22 2 11 13m11-11-7 20-4-9-9-4z",
  volume: "M11 5 6 9H2v6h4l5 4zm4.5 3.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13",
  volumeOff: "M11 5 6 9H2v6h4l5 4zm11 4-6 6m0-6 6 6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
