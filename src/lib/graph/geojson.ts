import type { Graph } from "@/lib/graph/types";

/** Tracé GeoJSON d'un chemin (§6.3). Attention : GeoJSON ordonne [longitude, latitude]. */
export type LineStringFeature = {
  type: "Feature";
  properties: Record<string, never>;
  geometry: { type: "LineString"; coordinates: [number, number][] };
};

export function pathToGeoJson(graph: Graph, path: readonly string[]): LineStringFeature {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: path.map((id) => {
        const node = graph.nodes.get(id)!;
        return [node.longitude, node.latitude];
      }),
    },
  };
}
