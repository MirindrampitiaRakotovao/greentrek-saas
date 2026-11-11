import { describe, expect, it } from "vitest";

import { buildMapHtml, safeJson } from "../../mobile/src/lib/map-html";

/* Carte d'un circuit dans l'application mobile (lot A4a) : page Leaflet générée. */

const steps = [
  { ordre: 1, nom: "Mahambo", latitude: -17.49, longitude: 49.45 },
  { ordre: 2, nom: "Morafeno", latitude: -17.52, longitude: 49.44 },
];

describe("carte de l'application mobile", () => {
  it("contient les étapes, le tracé réel et l'attribution OpenStreetMap", () => {
    const html = buildMapHtml({
      steps,
      trace: [
        [-17.49, 49.45],
        [-17.5, 49.445],
        [-17.52, 49.44],
      ],
      interactive: true,
    });
    expect(html).toContain('"nom":"Mahambo"');
    expect(html).toContain("[-17.5,49.445]");
    expect(html).toContain("tile.openstreetmap.org");
    expect(html).toContain("contributeurs OpenStreetMap");
    expect(html).toContain("leaflet@1.9.4");
  });

  it("un nom d'étape ne peut pas fermer la balise <script> (pas d'injection)", () => {
    const html = buildMapHtml({
      steps: [{ ordre: 1, nom: "</script><script>alert(1)</script>", latitude: 0, longitude: 0 }],
      trace: null,
      interactive: false,
    });
    expect(html).not.toContain("</script><script>alert(1)");
    expect(safeJson({ a: "<b>&" })).toBe('{"a":"\\u003cb\\u003e\\u0026"}');
    expect(JSON.parse(safeJson({ a: "<b>&" }))).toEqual({ a: "<b>&" });
  });

  it("noms des étapes affichés comme du texte, jamais comme du HTML (étiquettes)", () => {
    const html = buildMapHtml({
      steps: [{ ordre: 1, nom: "<img src=x onerror=alert(1)>", latitude: 0, longitude: 0 }],
      trace: null,
      interactive: false,
      labels: true,
    });
    expect(html).toContain("label.textContent = s.nom");
    expect(html).not.toContain("bindTooltip(s.nom");
    expect(html).not.toContain("<img src=x");
  });

  it("mode sombre : tuiles assombries ; mode clair : tuiles d'origine", () => {
    const dark = buildMapHtml({ steps, trace: null, interactive: false, dark: true });
    const light = buildMapHtml({ steps, trace: null, interactive: false });
    expect(dark).toContain("invert(1)");
    expect(light).not.toContain("invert(1)");
  });
});
