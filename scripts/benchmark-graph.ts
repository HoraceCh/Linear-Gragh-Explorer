/** Run with npm exec --offline -- vite-node scripts/benchmark-graph.ts. */
import ELK from "elkjs/lib/elk.bundled.js";
import { performance } from "node:perf_hooks";
import { platform, arch, cpus } from "node:os";
import { scaleGraph } from "../src/demo";
import { graphProjection, defaultVisibility } from "../src/graph/semantics";
import { dependencyLayoutInput } from "../src/graph/layout";
import { dependencyImpact } from "../src/analytics";

const elk = new ELK();
const measuredRuns = 5;
const round = (value: number) => Number(value.toFixed(3));
function median(values: number[]) {
  return round(values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)]);
}

function profileSync(action: () => unknown) {
  const timings: number[] = [];
  action();
  for (let sample = 0; sample < measuredRuns; sample++) {
    const start = performance.now();
    for (let i = 0; i < 50; i++) action();
    timings.push((performance.now() - start) / 50);
  }
  return median(timings);
}

async function profileLayout(projection: ReturnType<typeof graphProjection>) {
  const timings: number[] = [];
  for (let sample = 0; sample <= measuredRuns; sample++) {
    const input = dependencyLayoutInput(projection.nodes, projection.links);
    const start = performance.now();
    const output = await elk.layout(input);
    const duration = performance.now() - start;
    if (output.children?.length !== projection.nodes.length ||
        output.edges?.length !== projection.links.length ||
        !output.edges?.every((edge) => edge.sections?.length)) {
      throw new Error("Incomplete synthetic layout");
    }
    if (sample > 0) timings.push(duration);
  }
  return { medianMs: median(timings), minMs: round(Math.min(...timings)), maxMs: round(Math.max(...timings)) };
}

console.log(JSON.stringify({ node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, measuredRuns }));
for (const count of [20, 50, 100, 200] as const) {
  const graph = scaleGraph(count);
  const issues = graph.items.filter((item) => item.kind === "issue");
  const selected = issues[Math.floor(issues.length / 2)].id;
  const dependency = () => graphProjection(graph, issues, "dependency", defaultVisibility);
  const focused = graphProjection(graph, issues, "focus", defaultVisibility, selected);
  console.log(JSON.stringify({
    issues: count,
    relationships: graph.links.filter((edge) => edge.kind === "blocks" || edge.kind === "related").length,
    blocks: dependency().links.length,
    focusNodes: focused.nodes.length,
    focusEdges: focused.links.length,
    projectionMs: profileSync(dependency),
    impactMs: profileSync(() => dependencyImpact(graph, selected)),
    layout: await profileLayout(dependency()),
    focusLayout: await profileLayout(focused),
  }));
}
