import type { ElkNode } from "elkjs/lib/elk-api";
import type { Item, Link } from "../model";
// Dependency topology only. Related-to display links never influence layering.
export function dependencyLayoutInput(nodes: Item[], links: Link[]): ElkNode {
  return {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.cycleBreaking.strategy": "GREEDY",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.spacing.nodeNode": "44",
      "elk.layered.spacing.nodeNodeBetweenLayers": "100",
    },
    children: nodes.map((n) => ({ id: n.id, width: 280, height: 164 })),
    edges: links
      .filter((e) => e.kind !== "related" && e.kind !== "membership")
      .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  };
}
