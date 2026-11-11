import { describe, expect, it } from "vitest";

import {
  darkTheme,
  lightTheme,
  resolveTheme,
  STATUS_COLORS,
  type Theme,
} from "../../mobile/src/theme/tokens";

/*
 * Refonte de l'application mobile (thèmes clair et sombre) : contrastes WCAG 2.1 AA (4,5:1
 * pour le texte) de chaque couple texte / fond réellement utilisé. Les couleurs translucides
 * sont composées sur leur fond avant le calcul.
 */

type RGBA = [number, number, number, number];

function parse(color: string): RGBA {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = color.match(/^rgba?\(([^)]+)\)$/);
  if (!rgba) throw new Error(`Couleur illisible : ${color}`);
  const [r, g, b, a = "1"] = rgba[1]!.split(",").map((x) => x.trim());
  return [Number(r), Number(g), Number(b), Number(a)];
}

/** Couleur (éventuellement translucide) posée sur un fond opaque. */
function over(color: string, background: string): RGBA {
  const [r, g, b, a] = parse(color);
  const [br, bg, bb] = parse(background);
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];
}

function luminance([r, g, b]: RGBA): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(text: string, background: string, base: string): number {
  const bg = over(background, base);
  const fg = over(text, `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`);
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

function pairs(t: Theme): [string, string, string][] {
  return [
    ["texte sur fond", t.text, t.bg],
    ["texte sur carte", t.text, t.surface],
    ["texte sur champ", t.text, t.surfaceAlt],
    ["texte secondaire sur fond", t.textMuted, t.bg],
    ["texte secondaire sur carte", t.textMuted, t.surface],
    ["accent sur fond", t.accent, t.bg],
    ["accent sur carte", t.accent, t.surface],
    ["accent sur teinte d'accent", t.accent, t.accentSoft],
    ["bouton principal", t.onPrimary, t.primary],
    ["erreur sur carte", t.danger, t.surface],
    ["erreur sur fond d'erreur", t.danger, t.dangerSoft],
    ["texte sur verre opaque", t.text, t.glass.fillSolid],
  ];
}

describe("thèmes de l'application mobile : contrastes AA", () => {
  for (const [name, theme] of [
    ["clair", lightTheme],
    ["sombre", darkTheme],
  ] as const) {
    it(`thème ${name} : chaque texte atteint 4,5:1`, () => {
      const faibles = pairs(theme)
        .map(([label, fg, bg]) => ({ label, ratio: contrast(fg, bg, theme.bg) }))
        .filter((p) => p.ratio < 4.5);
      expect(faibles).toEqual([]);
    });
  }

  it("pastilles de statut des réservations : 4,5:1 dans les deux thèmes", () => {
    for (const [mode, theme] of [
      ["light", lightTheme],
      ["dark", darkTheme],
    ] as const) {
      for (const { bg, fg } of Object.values(STATUS_COLORS[mode])) {
        expect(contrast(fg, bg, theme.surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("préférence : système (avec repli clair), clair, sombre", () => {
    expect(resolveTheme("system", "dark")).toBe(darkTheme);
    expect(resolveTheme("system", null)).toBe(lightTheme);
    expect(resolveTheme("light", "dark")).toBe(lightTheme);
    expect(resolveTheme("dark", "light")).toBe(darkTheme);
  });
});
