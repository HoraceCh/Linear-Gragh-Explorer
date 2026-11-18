/** Compare a queued superseding request with worker termination in a Node isolate. */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { once } from "node:events";
import { performance } from "node:perf_hooks";
import { scaleGraph } from "../src/demo";
import { graphProjection, defaultVisibility } from "../src/graph/semantics";
import { dependencyLayoutInput } from "../src/graph/layout";

const graph = scaleGraph(200);
const full = graphProjection(graph, graph.items, "dependency", defaultVisibility);
const focus = graphProjection(graph, graph.items, "focus", defaultVisibility, "scale-100");
const fullInput = dependencyLayoutInput(full.nodes, full.links);
const focusInput = dependencyLayoutInput(focus.nodes, focus.links);
const modulePath = pathToFileURL(createRequire(import.meta.url).resolve("elkjs/lib/elk.bundled.js")).href;
const workerSource = `
  import { parentPort, workerData } from "node:worker_threads";
  const {default: ELK} = await import(workerData);
  const elk = new ELK();
  let queue = Promise.resolve();
  parentPort.on("message", ({id, input}) => {
    queue = queue.then(async () => {
      if (id === "old") parentPort.postMessage("started");
      await elk.layout(input);
      parentPort.postMessage(id);
    });
  });
`;
function start() {
  return new Worker(new URL("data:text/javascript," + encodeURIComponent(workerSource)), {workerData: modulePath});
}

async function supersede(cancel: boolean) {
  let worker = start();
  try {
    worker.postMessage({ id: "old", input: fullInput });
    await once(worker, "message"); // the old job is running and its runtime is initialized
    const begin = performance.now();
    if (cancel) {
      await worker.terminate();
      worker = start();
    }
    worker.postMessage({ id: "focus", input: focusInput });
    while ((await once(worker, "message"))[0] !== "focus") { /* ignore obsolete output */ }
    return performance.now() - begin;
  } finally {
    await worker.terminate();
  }
}

for (let i = 0; i < 5; i++) {
  const queuedFirst = i % 2 === 0;
  const first = await supersede(!queuedFirst);
  const second = await supersede(queuedFirst);
  console.log(JSON.stringify({run: i + 1, queuedMs: queuedFirst ? first : second, canceledMs: queuedFirst ? second : first}));
}
