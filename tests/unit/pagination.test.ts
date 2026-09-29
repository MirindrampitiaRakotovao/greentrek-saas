import { describe, expect, it } from "vitest";

import { pageItems } from "@/lib/pagination";

describe("pagination numérotée", () => {
  it("peu de pages : tous les numéros", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(1, 3)).toEqual([1, 2, 3]);
    expect(pageItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("beaucoup de pages : première, dernière, voisines et « … »", () => {
    expect(pageItems(6, 12)).toEqual([1, "…", 5, 6, 7, "…", 12]);
    expect(pageItems(1, 12)).toEqual([1, 2, "…", 12]);
    expect(pageItems(12, 12)).toEqual([1, "…", 11, 12]);
  });

  it("un « … » ne remplace jamais une seule page", () => {
    expect(pageItems(4, 12)).toEqual([1, 2, 3, 4, 5, "…", 12]);
    expect(pageItems(9, 12)).toEqual([1, "…", 8, 9, 10, 11, 12]);
  });
});
