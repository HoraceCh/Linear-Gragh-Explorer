import { useEffect, useMemo, useRef, useState } from "react";
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
import { LayoutWorkerSession } from "./workerSession";
import { cardBounds, centerCard, graphViewport } from "./viewport";
import "./canvas.css";

function motionDuration() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180;
}
function Card({ data, selected }: NodeProps) {
  const n = data.item as Item;
  return (
    <div className={`graph-node ${n.kind} ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-top">
        <span>{n.identifier || "边界"}{n.parentId ? " · 子任务" : ""}</span>
        {data.blocked === true && <span className="blocked-label">受阻</span>}
        <span className={`dot ${n.statusType || ""}`} />
      </div>
      <strong title={n.title}>{n.title}</strong>
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
  blocked,
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
  blocked?: ReadonlySet<string>;
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
  const focusId = mode === "focus" ? selected : undefined;
  const projection = useMemo(() => graphProjection(
    graph, items, mode, visibility, focusId, depth, direction,
  ), [graph, items, mode, visibility, focusId, depth, direction]);
  const grouped = mode === "combined" && visibility.grouping;
  const fingerprint = useMemo(() =>
    layoutFingerprint(projection.nodes, projection.links, grouped), [projection, grouped]);
  const [worker] = useState(() => new LayoutWorkerSession(() => new ELK({ workerFactory: () => new ElkWorker() })));
  useEffect(() => () => worker.dispose(), [worker]);
  const [nodes, setNodes] = useState<Node[]>([]),
    [routes, setRoutes] = useState<Map<string, RoutePoint[]>>(new Map()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [canvasHeight, setCanvasHeight] = useState(460),
    [layoutVersion, setLayoutVersion] = useState(0),
    [map, setMap] = useState(true);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const layoutKey = JSON.stringify([fingerprint, layoutVersion]);
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

  const revision = useRef(0);
  const latest = useRef({ projection, graph, mode });
  latest.current = { projection, graph, mode };
  useEffect(() => {
    const controller = new AbortController();
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
          const lane = lanes.get(key);
          if (lane) lane.push(n);
          else lanes.set(key, [n]);
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
              background: "var(--lane-fill)",
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
      } else if (p.nodes.length) {
        const layout: ElkNode = await worker.run(dependencyLayoutInput(p.nodes, p.links), controller.signal);
        const byId = new Map(p.nodes.map(item => [item.id, item]));
        ns = (layout.children || []).map((n) => ({
          id: n.id,
          type: "card",
          position: { x: n.x || 0, y: n.y || 0 },
          width: 280,
          height: 164,
          data: { item: byId.get(n.id)! },
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
      if (controller.signal.aborted || run !== revision.current) return;
      setNodes(ns);
      setRoutes(routes);
      setBusy(false);
      setReadyKey(layoutKey);
    };
    void work().catch(() => {
      if (!controller.signal.aborted) {
        setBusy(false);
        setError("布局失败，请缩小筛选范围或重试。");
      }
    });
    return () => controller.abort();
  }, [layoutKey, worker]);

  const cards = useMemo(() => cardBounds(nodes), [nodes]);
  const panel = shell.current;
  function moveCamera(targetId?: string, fitAll = false) {
    if (!panel || !flow || readyKey !== layoutKey) return;
    const { clientWidth: width, clientHeight: height } = panel;
    const card = targetId && cards.find(card => card.id === targetId);
    const camera = card ? centerCard(card, width, height, Math.max(0.85, flow.getZoom())) :
      graphViewport(cards, width, height, fitAll);
    if (camera) void flow.setViewport(camera, { duration: motionDuration() });
  }

  useEffect(() => {
    if (!flow || !panel || readyKey !== layoutKey) return;
    const search = query.trim().toLowerCase();
    const issues = latest.current.projection.nodes;
    const match = search && (issues.find(n => n.identifier?.toLowerCase() === search) ||
      issues.find(n => n.title.toLowerCase().includes(search)));
    const frame = requestAnimationFrame(() => moveCamera(match ? match.id : focusId));
    return () => cancelAnimationFrame(frame);
  }, [flow, panel, readyKey, layoutKey, focusId, query]);
  const direct = mode === "focus" && selected ? neighborhood(graph, selected, 1, direction) : null;
  const displayNodes: Node[] = currentLayoutNodes(nodes, projection.nodes, grouped).map((n) => ({
    ...n,
    selected: n.id === selected,
    style: { ...n.style, opacity: direct && n.type !== "group" && !direct.has(n.id) ? 0.5 : 1 },
    ariaLabel: n.type === "card" ? `${(n.data.item as Item).identifier || ""} ${(n.data.item as Item).title}` : undefined,
    data: { ...n.data, review: reviews[n.id], blocked: blocked?.has(n.id) },
  }));
  return (
    <>
      <div className="graph-actions">
        <span role="status">
          {projection.nodes.length} 节点 · {projection.links.length} 条可见关系{" "}
          {busy ? "· 布局中…" : ""}
        </span>
        <button
          className="button small"
          onClick={() => setLayoutVersion((v) => v + 1)}
        >
          自动布局
        </button>
        <button className="button small" disabled={busy || !cards.length} onClick={() => moveCamera(undefined, true)}>
          适应全图
        </button>
        <button className="button small" disabled={busy || !cards.some(card => card.id === selected)} onClick={() => moveCamera(selected)}>
          居中选中项
        </button>
        <button className="button small" disabled={busy || !cards.length} onClick={() => moveCamera(focusId)}>
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
      <div className="graph-shell v2-graph" aria-label="任务关系图" role="region" ref={shell}
        onKeyDown={event => {
          if (event.key !== "Enter" && event.key !== " ") return;
          const element = event.target as HTMLElement;
          if (!element.classList.contains("react-flow__node")) return;
          const item = projection.nodes.find(n => n.id === element.dataset.id);
          if (item) { event.preventDefault(); onSelect(item); }
        }} style={{height: canvasHeight, minHeight: 360}}>
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
          onInit={setFlow}
          onNodeClick={(_, n) => n.data.item && onSelect(n.data.item as Item)}
          minZoom={0.001}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          onlyRenderVisibleElements
          colorMode={dark ? "dark" : "light"}
          attributionPosition="bottom-left"
        >
          <Background gap={24} />
          <Controls position="top-left" showFitView={false} showInteractive={false} />
          {map && (
            <MiniMap
              ariaLabel="图谱小地图，可拖动或缩放"
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
        {(mode !== "combined" || visibility.blocks) && <span>🟠 阻塞 →</span>}
        {(mode === "focus" || (mode === "combined" && visibility.parent)) && <span>🟣 父子 →</span>}
        {mode === "combined" && visibility.related && <span>┄ 一般相关（无向）</span>}
        {grouped && <span>分组表示项目或里程碑</span>}
      </div>
    </>
  );
}
