import { useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  BaseEdge,
  type EdgeProps,
  type NodeProps,
  type ReactFlowInstance,
  type Node,
  type Edge,
} from "@xyflow/react";
import ELK, { type ElkNode } from "elkjs/lib/elk-api";
import ElkWorker from "elkjs/lib/elk-worker.min.js?worker";
import { neighborhood, type Graph, type Item } from "../model";
import { dependencyLayoutInput } from "./layout";
import { renderEdges, currentLayoutNodes, type RoutePoint } from "./edges";
import {
  graphProjection,
  layoutFingerprint,
  type GraphMode,
  type Visibility,
} from "./semantics";
import { type ReviewResult, reviewLabels } from "../review/engine";
const elk = new ELK({ workerFactory: () => new ElkWorker() });
function Card({ data, selected }: NodeProps) {
  const n = data.item as Item;
  return (
    <div className={`graph-node ${n.kind} ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-top">
        <span>{n.identifier || "边界"}</span>
        <span className={`dot ${n.statusType || ""}`} />
      </div>
      <strong>{n.title}</strong>
      <div className="node-bottom">
        <span>{n.assignee || "未分配"}</span>
        <span>{n.status || ""}</span>
      </div>
      {data.review ? (
        <small className="node-review">
          {reviewLabels[(data.review as ReviewResult).status]}
        </small>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
function RouteEdge(props: EdgeProps) {
  const [hover, setHover] = useState(false);
  const points = props.data?.points as { x: number; y: number }[] | undefined;
  const path = points?.length
    ? points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ")
    : `M ${props.sourceX} ${props.sourceY} C ${props.sourceX + 70} ${props.sourceY}, ${props.targetX - 70} ${props.targetY}, ${props.targetX} ${props.targetY}`;
  return (
    <g onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        style={props.style}
        interactionWidth={20}
      />
      <title>{String(props.data?.kind)}</title>
      {(hover || props.selected) && (
        <text
          x={(props.sourceX + props.targetX) / 2}
          y={(props.sourceY + props.targetY) / 2 - 8}
          fontSize={12}
          fill="var(--text)"
          stroke="var(--panel)"
          strokeWidth={3}
          paintOrder="stroke"
        >
          {String(props.data?.kind)}
        </text>
      )}
    </g>
  );
}
const nodeTypes = { card: Card },
  edgeTypes = { routed: RouteEdge };
export function GraphView({
  graph,
  items,
  mode,
  visibility,
  selected,
  onSelect,
  dark,
  depth,
  direction,
  reviews,
  query,
}: {
  graph: Graph;
  items: Item[];
  mode: GraphMode;
  visibility: Visibility;
  selected?: string;
  onSelect: (i: Item) => void;
  dark: boolean;
  depth: number;
  direction: "both" | "up" | "down";
  reviews: Record<string, ReviewResult>;
  query: string;
}) {
  const projection = graphProjection(
    graph,
    items,
    mode,
    visibility,
    selected,
    depth,
    direction,
  );
  const grouped = mode === "combined" && visibility.grouping;
  const fingerprint = layoutFingerprint(
    projection.nodes,
    projection.links,
    grouped,
  );
  const [nodes, setNodes] = useState<Node[]>([]),
    [routes, setRoutes] = useState<Map<string, RoutePoint[]>>(new Map()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [canvasHeight, setCanvasHeight] = useState(460),
    [layoutVersion, setLayoutVersion] = useState(0),
    [map, setMap] = useState(true);
  const instance = useRef<ReactFlowInstance | null>(null);
  const shell = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const measure = () => {
      if (shell.current) setCanvasHeight(Math.max(360, window.innerHeight - shell.current.getBoundingClientRect().top - 62));
    };
    const observer = new ResizeObserver(measure);
    if (shell.current?.parentElement) observer.observe(shell.current.parentElement);
    window.addEventListener("resize", measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  const lastFit = useRef("");
  const revision = useRef(0);
  const latest = useRef({ projection, graph });
  latest.current = { projection, graph };
  useEffect(() => {
    let stale = false;
    const run = ++revision.current;
    setBusy(true);
    setError("");
    const { projection: p, graph: g } = latest.current;
    const work = async () => {
      let ns: Node[] = [];
      const routes = new Map<string, RoutePoint[]>();
      if (grouped) {
        const lanes = new Map<string, Item[]>();
        for (const n of p.nodes) {
          const key = n.milestoneId || n.projectId || "unassigned";
          lanes.set(key, [...(lanes.get(key) || []), n]);
        }
        let y = 0;
        for (const [key, list] of lanes) {
          const title = g.items.find((n) => n.id === key);
          const h = 70 + Math.ceil(list.length / 3) * 200;
          const id = `group:${key}`;
          ns.push({
            id,
            type: "group",
            position: { x: 0, y },
            data: { label: title?.title || "未分组" },
            style: {
              width: 960,
              height: h,
              background: dark ? "#71619b14" : "#71619b08",
              border: "1px solid var(--border)",
              borderRadius: 12,
            },
            draggable: false,
            selectable: false,
          });
          list.forEach((n, i) =>
            ns.push({
              id: n.id,
              type: "card",
              parentId: id,
              extent: "parent",
              position: {
                x: 24 + (i % 3) * 310,
                y: 52 + Math.floor(i / 3) * 200,
              },
              data: { item: n },
              width: 280,
              height: 164,
            }),
          );
          y += h + 60;
        }
      } else {
        const layout: ElkNode = await elk.layout(
          dependencyLayoutInput(p.nodes, p.links),
        );
        ns = (layout.children || []).map((n) => ({
          id: n.id,
          type: "card",
          position: { x: n.x || 0, y: n.y || 0 },
          width: 280,
          height: 164,
          data: { item: p.nodes.find((i) => i.id === n.id)! },
        }));
        for (const e of layout.edges || []) {
          if (e.sections?.length)
            routes.set(
              e.id,
              e.sections.flatMap((s) => [
                s.startPoint,
                ...(s.bendPoints || []),
                s.endPoint,
              ]),
            );
        }
      }
      if (stale || run !== revision.current) return;
      setNodes(ns);
      setRoutes(routes);
      setBusy(false);
      // Structural changes fit once. Details, selection and theme never remount the canvas.
      const fitKey = fingerprint + layoutVersion;
      if (lastFit.current !== fitKey) {
        lastFit.current = fitKey;
        requestAnimationFrame(() =>
          instance.current?.fitView({
            minZoom: 0.65,
            maxZoom: 1,
            padding: 0.18,
            duration: 200,
          }),
        );
      }
    };
    void work().catch(() => {
      if (!stale) {
        setBusy(false);
        setError("布局失败，请缩小筛选范围或重试。");
      }
    });
    return () => {
      stale = true;
    };
  }, [fingerprint, layoutVersion]);
  useEffect(() => {
    if (!query) return;
    const found =
      nodes.find(
        (n) =>
          (n.data.item as Item | undefined)?.identifier?.toLowerCase() ===
          query.toLowerCase(),
      ) ||
      nodes.find((n) =>
        (n.data.item as Item | undefined)?.title
          .toLowerCase()
          .includes(query.toLowerCase()),
      );
    if (found)
      instance.current?.fitView({
        nodes: [{ id: found.id }],
        minZoom: 0.85,
        maxZoom: 1,
        duration: 200,
      });
  }, [query, nodes]);
  const direct = mode === "focus" && selected ? neighborhood(graph, selected, 1, direction) : null;
  const displayNodes: Node[] = currentLayoutNodes(nodes, projection.nodes, grouped).map((n) => ({
    ...n,
    selected: n.id === selected,
    style: { ...n.style, opacity: direct && n.type !== "group" && !direct.has(n.id) ? 0.5 : 1 },
    data: { ...n.data, review: reviews[n.id] },
  }));
  return (
    <>
      <div className="graph-actions">
        <span>
          {projection.nodes.length} 节点 · {projection.links.length} 条可见关系{" "}
          {busy ? "· 布局中…" : ""}
        </span>
        <button
          className="button small"
          onClick={() => setLayoutVersion((v) => v + 1)}
        >
          自动布局
        </button>
        <button
          className="button small"
          onClick={() =>
            instance.current?.fitView({
              minZoom: 0.65,
              maxZoom: 1,
              padding: 0.2,
            })
          }
        >
          重置视图
        </button>
        <label>
          <input
            type="checkbox"
            checked={map}
            onChange={(e) => setMap(e.target.checked)}
          />
          小地图
        </label>
      </div>
      <div className="graph-shell v2-graph" ref={shell} style={{height: canvasHeight, minHeight: 360}}>
        {error && <div className="graph-empty">{error}</div>}
        <ReactFlow<Node, Edge>
          nodes={displayNodes}
          edges={renderEdges(projection.links, grouped ? undefined : routes).map((e) => ({ ...e,
            style: { ...e.style,
              strokeWidth: mode === "focus" && (e.source === selected || e.target === selected) ? 2.7 : 1.7,
              opacity: direct && e.source !== selected && e.target !== selected ? 0.45 : 1,
            },
          }))}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={(i) => {
            instance.current = i;
            i.fitView({ minZoom: 0.65, maxZoom: 1 });
          }}
          onNodeClick={(_, n) => n.data.item && onSelect(n.data.item as Item)}
          minZoom={0.15}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          onlyRenderVisibleElements
          colorMode={dark ? "dark" : "light"}
          attributionPosition="bottom-left"
        >
          <Background gap={24} />
          <Controls position="top-left" showInteractive={false} />
          {map && (
            <MiniMap
              style={{ width: 180, height: 110, bottom: 16, right: 12 }}
              nodeColor={(n) =>
                n.type === "group" ? (dark ? "#374151" : "#e9e4f4") : "#9273d1"
              }
              nodeStrokeColor={dark ? "#e5d8ff" : "#48366e"}
              nodeStrokeWidth={3}
              nodeBorderRadius={5}
              bgColor={dark ? "#111a27" : "#faf9fd"}
              maskColor={dark ? "#07101c88" : "#b7b0cb55"}
              maskStrokeColor={dark ? "#dfcdfb" : "#6b4dac"}
              maskStrokeWidth={2}
              pannable
              zoomable
            />
          )}
        </ReactFlow>
        {!projection.nodes.length && !busy && (
          <div className="graph-empty">
            {mode === "focus" && !selected ? "请先选择一个聚焦任务。" : "没有匹配任务。请选择项目或调整筛选。"}
          </div>
        )}
      </div>
      <div className="graph-legend">
        <span>🟠 阻塞 →</span>
        <span>🟣 父子 →</span>
        <span>┄ 一般相关（无向）</span>
        <span>归属通过分组表示；边标签悬停显示</span>
      </div>
    </>
  );
}
