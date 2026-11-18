import { getViewportForBounds, type Node, type Rect } from "@xyflow/react";

export function cardBounds(nodes: Node[]) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  return nodes.flatMap(node => {
    if (node.type === "group") return [];
    const group = node.parentId ? byId.get(node.parentId) : undefined;
    return [{
      id: node.id,
      x: node.position.x + (group?.position.x ?? 0),
      y: node.position.y + (group?.position.y ?? 0),
      width: node.width ?? 280,
      height: node.height ?? 164,
    }];
  });
}

export function centerCard(rect: Rect, width: number, height: number, zoom: number) {
  return {
    x: width / 2 - (rect.x + rect.width / 2) * zoom,
    y: height / 2 - (rect.y + rect.height / 2) * zoom,
    zoom,
  };
}

/** Initial and reset cameras prioritize a readable first card. Only explicit overview fits all. */
export function graphViewport(cards: Rect[], width: number, height: number, fitAll: boolean) {
  if (!cards.length || !width || !height) return;
  const leftmost = cards.reduce((first, card) =>
    card.x < first.x || (card.x === first.x && card.y < first.y) ? card : first);
  const bounds = cards.reduce((b, card) => ({
    left: Math.min(b.left, card.x),
    top: Math.min(b.top, card.y),
    right: Math.max(b.right, card.x + card.width),
    bottom: Math.max(b.bottom, card.y + card.height),
  }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
  const camera = getViewportForBounds({
    x: bounds.left, y: bounds.top, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top,
  }, width, height, 0.001, 1, 0.18);
  if (fitAll || camera.zoom >= 0.8) return camera;
  return centerCard(leftmost, width, height, 0.85);
}
