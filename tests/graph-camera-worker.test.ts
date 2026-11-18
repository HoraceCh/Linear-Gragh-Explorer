import { expect, it, vi } from "vitest";
import type { ElkNode } from "elkjs/lib/elk-api";
import { LayoutWorkerSession } from "../src/graph/workerSession";
import { cardBounds, centerCard, graphViewport } from "../src/graph/viewport";

const input: ElkNode = { id: "root", children: [] };

it("terminates an obsolete worker and starts the next layout before an old result arrives", async () => {
  let finishOld!: (graph: ElkNode) => void;
  const first = {
    layout: () => new Promise<ElkNode>(resolve => { finishOld = resolve; }),
    terminateWorker: vi.fn(),
  };
  const next = { layout: vi.fn().mockResolvedValue(input), terminateWorker: vi.fn() };
  const make = vi.fn().mockReturnValueOnce(first).mockReturnValue(next);
  const session = new LayoutWorkerSession(make);
  const controller = new AbortController();
  const pending = session.run(input, controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(first.terminateWorker).toHaveBeenCalledOnce();
  const nextSignal = new AbortController();
  await expect(session.run(input, nextSignal.signal)).resolves.toBe(input);
  finishOld({ id: "obsolete" });
  nextSignal.abort();
  await session.run(input, new AbortController().signal);
  expect(make).toHaveBeenCalledTimes(2);
  expect(next.terminateWorker).not.toHaveBeenCalled();
  session.dispose();
  expect(next.terminateWorker).toHaveBeenCalledOnce();
});

it("skips allocation if the layout was already canceled", async () => {
  const make = vi.fn();
  await expect(new LayoutWorkerSession(make).run(input, AbortSignal.abort())).rejects.toMatchObject({name:"AbortError"});
  expect(make).not.toHaveBeenCalled();
});

it("reset centers a readable upstream card in a long graph and explicit overview includes both ends", () => {
  const left = {x:6, y:20, width:280, height:164};
  const right = {...left, x:30000};
  const reset = graphViewport([right, left], 1000, 500, false)!;
  expect(reset.zoom).toBeGreaterThanOrEqual(0.8);
  expect(reset).toEqual(centerCard(left, 1000, 500, reset.zoom));
  const fit = graphViewport([right, left], 1000, 500, true)!;
  expect(fit.x + left.x * fit.zoom).toBeGreaterThanOrEqual(0);
  expect(fit.x + (right.x + right.width) * fit.zoom).toBeLessThanOrEqual(1000);
});

it("selection in a grouped lane centers the absolute card bounds", () => {
  const cards = cardBounds([
    { id: "lane", type: "group", position: { x: 50, y: 200 }, data: {} },
    { id: "task", parentId: "lane", type: "card", position: { x: 10, y: 32 }, data: {} },
  ]);
  expect(cards).toEqual([{ id:"task", x:60, y:232, width:280, height:164 }]);
  expect(centerCard(cards[0], 800, 600, 1)).toEqual({ x:200, y:-14, zoom:1 });
  expect(graphViewport([], 800, 600, true)).toBeUndefined();
});
