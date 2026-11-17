import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import ELK from "elkjs/lib/elk-api";
import ElkWorker from "elkjs/lib/elk-worker.min.js?worker";
import {
  Waypoints,
  LayoutDashboard,
  FolderOpen,
  GitBranch,
  Network,
  Scan,
  Layers,
  Search,
  Sun,
  Moon,
  RefreshCw,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  X,
  SlidersHorizontal,
  LogOut,
  Link2,
  AlertTriangle,
  Maximize2,
} from "lucide-react";
import "@xyflow/react/dist/style.css";
import "./style.css";
import {
  analyze,
  emptyGraph,
  neighborhood,
  type Graph,
  type Item,
} from "./model";
import { demoGraph } from "./demo";
import { syncGraph } from "./api";
import {
  configuredClient,
  login,
  finishLogin,
  disconnect,
  callbackUrl,
} from "./auth";
const elk = new ELK({ workerFactory: () => new ElkWorker() });
const modes = [
  ["overview", "团队总览", LayoutDashboard],
  ["project", "项目探索", FolderOpen],
  ["hierarchy", "层级视图", GitBranch],
  ["dependency", "依赖视图", Network],
  ["focus", "聚焦模式", Scan],
  ["combined", "组合视图", Layers],
] as const;
type Mode = (typeof modes)[number][0];
function CardNode({ data, selected }: NodeProps) {
  const n = data.item as Item;
  return (
    <div className={`graph-node ${n.kind} ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-top">
        <span>{n.kind === "issue" ? n.identifier : n.kind.toUpperCase()}</span>
        <span className={`dot ${n.statusType || ""}`} />
      </div>
      <strong>{n.title}</strong>
      <div className="node-bottom">
        <span>
          {n.kind === "issue"
            ? n.assignee || "未分配"
            : n.kind === "project"
              ? "项目"
              : "里程碑"}
        </span>
        <span>{n.archived ? "已归档" : n.status || "归属分组"}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { card: CardNode };
function App() {
  const [graph, setGraph] = useState<Graph>(emptyGraph),
    [mode, setMode] = useState<Mode>("overview"),
    [project, setProject] = useState("all"),
    [selected, setSelected] = useState<Item | null>(null),
    [query, setQuery] = useState(""),
    [assignee, setAssignee] = useState("all"),
    [status, setStatus] = useState("all"),
    [archived, setArchived] = useState(false),
    [dark, setDark] = useState(localStorage.getItem("pvcr-theme") === "dark"),
    [settings, setSettings] = useState(false),
    [client, setClient] = useState(configuredClient),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [connected, setConnected] = useState(false),
    [depth, setDepth] = useState(1),
    [direction, setDirection] = useState<"both" | "up" | "down">("both"),
    [collapsed, setCollapsed] = useState<Set<string>>(new Set()),
    [layoutKey, setLayoutKey] = useState(0),
    [nodes, setNodes] = useState<Node[]>([]),
    [edges, setEdges] = useState<Edge[]>([]),
    [layoutBusy, setLayoutBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const [detailOpen, setDetailOpen] = useState(true);
  const [gone, setGone] = useState(0);
  const diagnostics = useMemo(() => analyze(graph), [graph]);
  const projects = graph.items.filter((n) => n.kind === "project"),
    issues = graph.items.filter((n) => n.kind === "issue");
  const load = async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError("");
    try {
      const next = await syncGraph(undefined, controller.signal, setProgress);
      const ids = new Set(next.items.map((n) => n.id));
      setGone(
        graphRef.current.source === "live"
          ? graphRef.current.items.filter((n) => !ids.has(n.id)).length
          : 0,
      );
      setGraph(next);
      setSelected((prev) => next.items.find((n) => n.id === prev?.id) || null);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "连接失败，请重试。");
    } finally {
      if (abort.current === controller) setBusy(false);
    }
  };
  useEffect(() => {
    finishLogin()
      .then((ok) => {
        if (ok) {
          setConnected(true);
          void load();
        }
      })
      .catch((e) => setError(e.message));
    return () => abort.current?.abort();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("pvcr-theme", dark ? "dark" : "light");
  }, [dark]);
  const reset = () => {
    abort.current?.abort();
    disconnect();
    setConnected(false);
    setGraph(emptyGraph());
    setSelected(null);
    setGone(0);
    setMode("overview");
    setError("");
    setProject("all");
    setQuery("");
  };
  const useDemo = () => {
    reset();
    setGraph(demoGraph());
    setSettings(false);
  };
  const filtered = useMemo(() => {
    let ns = graph.items.filter(
      (n) =>
        (project === "all" || n.id === project || n.projectId === project) &&
        (archived || !n.archived),
    );
    if (mode === "dependency" || mode === "focus")
      ns = ns.filter((n) => n.kind === "issue");
    if (mode === "focus" && selected) {
      const ids = neighborhood(graph, selected.id, depth, direction);
      ns = ns.filter((n) => ids.has(n.id));
    }
    ns = ns.filter(
      (n) =>
        (!query ||
          `${n.title} ${n.identifier || ""}`
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (assignee === "all" || n.kind !== "issue" || n.assignee === assignee) &&
        (status === "all" || n.kind !== "issue" || n.status === status),
    );
    const hidden = new Set<string>();
    for (const id of collapsed) {
      let front = [id];
      const seen = new Set(front);
      while (front.length) {
        const next: string[] = [];
        for (const v of front)
          for (const e of graph.links.filter(
            (e) => e.kind === "membership" || e.kind === "parent",
          ))
            if (e.source === v && !seen.has(e.target)) {
              seen.add(e.target);
              hidden.add(e.target);
              next.push(e.target);
            }
        front = next;
      }
    }
    ns = ns.filter((n) => !hidden.has(n.id));
    const ids = new Set(ns.map((n) => n.id));
    const es = graph.links.filter(
      (e) =>
        ids.has(e.source) &&
        ids.has(e.target) &&
        (mode === "hierarchy"
          ? e.kind === "membership" || e.kind === "parent"
          : mode === "dependency"
            ? e.kind === "blocks" || e.kind === "related"
            : true),
    );
    return { ns, es };
  }, [
    graph,
    project,
    archived,
    mode,
    selected?.id,
    depth,
    direction,
    query,
    assignee,
    status,
    collapsed,
  ]);
  useEffect(() => {
    let stale = false;
    if (mode === "overview" || mode === "project") return;
    setLayoutBusy(true);
    const { ns, es } = filtered;
    elk
      .layout({
        id: "root",
        layoutOptions: {
          "elk.algorithm": "layered",
          "elk.direction": "RIGHT",
          "elk.spacing.nodeNode": "36",
          "elk.layered.spacing.nodeNodeBetweenLayers": "65",
        },
        children: ns.map((n) => ({ id: n.id, width: 252, height: 108 })),
        edges: es.map((e) => ({
          id: e.id,
          sources: [e.source],
          targets: [e.target],
        })),
      })
      .then((result) => {
        if (stale) return;
        setNodes(
          (result.children || []).map((n) => ({
            id: n.id,
            type: "card",
            position: { x: n.x || 0, y: n.y || 0 },
            data: { item: ns.find((i) => i.id === n.id)! },
          })),
        );
        setEdges(
          es.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            type: "smoothstep",
            label:
              e.kind === "blocks"
                ? "阻塞"
                : e.kind === "parent"
                  ? "子任务"
                  : e.kind === "related"
                    ? "相关"
                    : "归属",
            markerEnd:
              e.kind === "related"
                ? undefined
                : {
                    type: MarkerType.ArrowClosed,
                    color: e.kind === "blocks" ? "#df8e60" : "#8c99b0",
                  },
            style: {
              stroke:
                e.kind === "blocks"
                  ? "#df8e60"
                  : e.kind === "parent"
                    ? "#9583d6"
                    : "#8c99b0",
              strokeWidth: e.kind === "blocks" ? 1.8 : 1.2,
              strokeDasharray: e.kind === "related" ? "5 5" : undefined,
            },
            labelStyle: { fontSize: 10, fill: dark ? "#d0d9e8" : "#5a667a" },
            labelBgStyle: { fill: dark ? "#171f2b" : "#fff" },
          })),
        );
      })
      .catch(() => setError("自动布局失败。请缩小筛选范围后重试。"))
      .finally(() => {
        if (!stale) setLayoutBusy(false);
      });
    return () => {
      stale = true;
    };
  }, [filtered, layoutKey, dark, mode]);
  const isGraph = !["overview", "project"].includes(mode);
  const title = modes.find((m) => m[0] === mode)![1];
  const projectTitle = projects.find((p) => p.id === project)?.title;
  const viewProject = (id: string) => {
    setProject(id);
    setMode("combined");
    setSelected(null);
    setQuery("");
  };
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Waypoints size={23} />
          </div>
          <div>
            <b>Graph Explorer</b>
            <small>LINEAR · PVCR</small>
          </div>
        </div>
        <div className="team-switch">
          <span className="team-avatar">P</span>
          <div>
            <b>PV Cleaning Robotics</b>
            <small>私有团队 · 只读访问</small>
          </div>
          <ShieldCheck size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {modes.map(([id, label, Icon]) => (
            <button
              key={id}
              className={mode === id ? "active" : ""}
              onClick={() => {
                setMode(id);
                if (id === "overview") setProject("all");
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="nav-label projects-label">
          PROJECTS <span>{projects.length || "—"}</span>
        </div>
        <div className="project-nav">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => viewProject(p.id)}
              className={project === p.id ? "current" : ""}
            >
              <span className="project-dot" />
              {p.title}
            </button>
          ))}
          {!projects.length && <p>连接后自动发现团队项目</p>}
        </div>
        <div className="sidebar-foot">
          <ShieldCheck size={17} />
          <div>
            <b>你的身份，你的数据</b>
            <small>仅 PVCR · 无写入操作</small>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            PVCR <ChevronRight size={14} />
            <b>{title}</b>
          </div>
          <div className="header-actions">
            <span className={`connection ${connected ? "online" : ""}`}>
              {graph.source === "synthetic"
                ? "合成演示"
                : connected
                  ? "Linear 已连接"
                  : "尚未连接"}
            </span>
            <button
              className="icon-button"
              aria-label="切换深浅色"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="button small" onClick={() => setSettings(true)}>
              <SlidersHorizontal size={15} />
              连接设置
            </button>
          </div>
        </header>
        <section className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">PVCR / TEAM INTELLIGENCE</div>
              <h1>
                {title}
                <span className="readonly">READ ONLY</span>
              </h1>
              <p>{projectTitle || "理解任务之间的关系，让下一步更清晰。"}</p>
            </div>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => (connected ? load() : setSettings(true))}
            >
              <RefreshCw size={15} className={busy ? "spin" : ""} />
              {busy ? "同步中…" : connected ? "刷新数据" : "连接 Linear"}
            </button>
          </div>
          {graph.source === "synthetic" && (
            <div className="notice demo">
              <span>
                合成演示环境 · 所有节点和关系均为测试数据，不代表 PVCR
                的真实状态。
              </span>
              <button onClick={reset}>
                退出演示 <X size={14} />
              </button>
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              <AlertTriangle size={17} />
              {error}
              <button onClick={() => setError("")} aria-label="关闭错误">
                <X size={16} />
              </button>
            </div>
          )}
          {busy && (
            <div className="notice" role="status">
              {progress}
              <button onClick={() => abort.current?.abort()}>取消同步</button>
            </div>
          )}
          {!graph.syncedAt && !busy ? (
            <div className="welcome">
              <div className="welcome-copy">
                <span className="pill">
                  <ShieldCheck size={14} /> 私有空间 · 只读连接
                </span>
                <h2>
                  让复杂任务，
                  <br />
                  形成清晰的脉络。
                </h2>
                <p>
                  从团队全貌到单项任务，探索项目、里程碑和依赖关系。使用自己的
                  Linear 身份连接，数据始终限定在 PVCR。
                </p>
                <div className="welcome-actions">
                  <button
                    className="button primary"
                    onClick={() => setSettings(true)}
                  >
                    连接我的 Linear <ArrowUpRight size={17} />
                  </button>
                  <button className="button" onClick={useDemo}>
                    体验合成演示
                  </button>
                </div>
                <small>
                  不会保存 Access Token，也不会修改 Linear 中的任何内容。
                </small>
              </div>
              <div className="illustration" aria-hidden="true">
                <div className="orbit one" />
                <div className="orbit two" />
                <div className="mini-card top">
                  <span className="dot completed" /> 场景与约束
                </div>
                <div className="mini-card center">
                  <Waypoints size={22} /> 团队关系网络
                </div>
                <div className="mini-card bottom">
                  <span className="dot started" /> 下一步行动
                </div>
                <div className="mini-label">CONTEXT → CLARITY</div>
              </div>
              <div className="welcome-features">
                <div>
                  <GitBranch />
                  <b>看清层级</b>
                  <span>项目、里程碑与子任务</span>
                </div>
                <div>
                  <Network />
                  <b>追踪依赖</b>
                  <span>分清阻塞与一般关联</span>
                </div>
                <div>
                  <Scan />
                  <b>聚焦当下</b>
                  <span>逐层探索上下游任务</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {!isGraph && (
                <>
                  <div className="stats">
                    {[
                      [projects.length, "团队项目", FolderOpen],
                      [issues.length, "任务总数", Layers],
                      [diagnostics.blocked.size, "有未完成前置项", GitBranch],
                      [diagnostics.cycles.length, "循环依赖组", AlertTriangle],
                    ].map(([value, label, Icon]: any) => (
                      <div className="stat" key={label}>
                        <span>
                          {label}
                          <Icon size={17} />
                        </span>
                        <strong>{value}</strong>
                        <small>
                          {label === "循环依赖组"
                            ? "仅检测 Blocks 关系"
                            : "基于完整团队快照"}
                        </small>
                      </div>
                    ))}
                  </div>
                  <div className="section-heading">
                    <h2>
                      项目空间 <span>{projects.length}</span>
                    </h2>
                    <span>
                      选择项目，展开它的关系图 <ArrowUpRight size={14} />
                    </span>
                  </div>
                  <div className="project-grid">
                    {projects.map((p) => {
                      const list = issues.filter((i) => i.projectId === p.id),
                        completed = list.filter(
                          (i) => i.statusType === "completed",
                        ).length;
                      return (
                        <button
                          className="project-card"
                          key={p.id}
                          onClick={() => viewProject(p.id)}
                        >
                          <div className="project-card-top">
                            <div className="folder-icon">
                              <FolderOpen size={23} />
                            </div>
                            <ArrowUpRight size={20} />
                          </div>
                          <h3>{p.title}</h3>
                          <p>
                            {list.length
                              ? `${list.length} 个任务 · ${graph.items.filter((i) => i.kind === "milestone" && i.projectId === p.id).length} 个里程碑`
                              : "暂无任务，项目已被自动发现"}
                          </p>
                          <div className="progress-track">
                            <i
                              style={{
                                width: `${list.length ? (completed / list.length) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <div className="project-card-footer">
                            <span>
                              {completed}/{list.length} 已完成
                            </span>
                            <span>打开图谱 →</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="overview-bottom">
                    <div className="health">
                      <h3>
                        <ShieldCheck size={18} /> 图谱检查
                      </h3>
                      <p>
                        {diagnostics.cycles.length
                          ? "检测到循环依赖，请在依赖视图中检查。"
                          : "没有检测到 Blocks 循环。"}
                      </p>
                      <p>
                        {diagnostics.isolated.length} 个任务没有任务间关系 ·{" "}
                        {diagnostics.archived} 个已归档任务
                      </p>
                      <p>
                        {graph.warnings.length} 个不可用引用 · {gone}{" "}
                        个上次存在、本次不可见的节点
                      </p>
                      <small>
                        不可见不等于已删除；可能是权限变化、移动或删除。没有工期数据，不计算关键路径。
                      </small>
                    </div>
                    <div className="workload">
                      <h3>团队分工</h3>
                      {[
                        ...new Set(issues.map((i) => i.assignee || "未分配")),
                      ].map((name, i) => (
                        <div key={name}>
                          <span className={`avatar a${i % 3}`}>
                            {name.slice(0, 1)}
                          </span>
                          <span>{name}</span>
                          <b>
                            {
                              issues.filter(
                                (n) => (n.assignee || "未分配") === name,
                              ).length
                            }
                            <small> 项任务</small>
                          </b>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {isGraph && (
                <>
                  <div className="filter-bar">
                    <label className="search">
                      <Search size={16} />
                      <input
                        aria-label="搜索任务"
                        placeholder="搜索任务名称或编号…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    <select
                      aria-label="项目筛选"
                      value={project}
                      onChange={(e) => setProject(e.target.value)}
                    >
                      <option value="all">全部项目</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="负责人筛选"
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                    >
                      <option value="all">全部负责人</option>
                      {[
                        ...new Set(
                          issues.map((i) => i.assignee).filter(Boolean),
                        ),
                      ].map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                    <select
                      aria-label="状态筛选"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="all">全部状态</option>
                      {[
                        ...new Set(issues.map((i) => i.status).filter(Boolean)),
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={archived}
                        onChange={(e) => setArchived(e.target.checked)}
                      />
                      已归档
                    </label>
                    <button
                      className="button small"
                      onClick={() => {
                        setQuery("");
                        setProject("all");
                        setAssignee("all");
                        setStatus("all");
                        setCollapsed(new Set());
                      }}
                    >
                      重置
                    </button>
                  </div>
                  {mode === "focus" && (
                    <div className="focus-toolbar">
                      <span>
                        {selected
                          ? `聚焦：${selected.identifier || selected.title}`
                          : "先从图中选择一个任务"}
                      </span>
                      <select
                        aria-label="聚焦方向"
                        value={direction}
                        onChange={(e) => setDirection(e.target.value as any)}
                      >
                        <option value="both">上下游与父子</option>
                        <option value="up">上游 / 父任务</option>
                        <option value="down">下游 / 子任务</option>
                      </select>
                      <span>{depth} 层</span>
                      <button
                        className="button small"
                        disabled={!selected}
                        onClick={() => setDepth((d) => d + 1)}
                      >
                        扩展一层
                      </button>
                      <button
                        className="button small"
                        onClick={() => setDepth(1)}
                      >
                        重置层数
                      </button>
                    </div>
                  )}
                  <div className="graph-shell">
                    <div className="graph-caption">
                      <span>
                        <span className="dot started" /> {filtered.ns.length}{" "}
                        节点 / {filtered.es.length} 关系{" "}
                        {layoutBusy && "· 布局中…"}
                      </span>
                      <button
                        className="button small"
                        onClick={() => setLayoutKey((k) => k + 1)}
                      >
                        <Maximize2 size={14} />
                        自动布局
                      </button>
                    </div>
                    <ReactFlow
                      key={`${mode}-${layoutKey}-${nodes.map((n) => n.id).join()}`}
                      nodes={nodes}
                      edges={edges}
                      nodeTypes={nodeTypes}
                      onNodeClick={(_, n) => {
                        setSelected(n.data.item as Item);
                        setDetailOpen(true);
                      }}
                      fitView
                      fitViewOptions={{
                        minZoom: 0.55,
                        maxZoom: 1,
                        padding: 0.2,
                      }}
                      minZoom={0.08}
                      maxZoom={1.8}
                      nodesConnectable={false}
                      nodesDraggable={false}
                      onlyRenderVisibleElements
                      colorMode={dark ? "dark" : "light"}
                    >
                      <Background gap={22} size={1} />
                      <Controls showInteractive={false} />
                      <MiniMap
                        pannable
                        zoomable
                        nodeColor={(n) =>
                          (n.data.item as Item).kind === "issue"
                            ? "#b0b8cd"
                            : "#8d7adc"
                        }
                      />
                    </ReactFlow>
                    {!filtered.ns.length && (
                      <div className="graph-empty">
                        没有符合条件的节点。请调整筛选或选择一个任务。
                      </div>
                    )}
                    <div className="legend">
                      <span>
                        <i className="line blocks" /> 阻塞 →
                      </span>
                      <span>
                        <i className="line parent" /> 父子 →
                      </span>
                      <span>
                        <i className="line" /> 归属 →
                      </span>
                      <span>
                        <i className="line related" /> 一般相关
                      </span>
                    </div>
                  </div>
                  <div className="graph-note">
                    <span>
                      箭头由前置任务指向被阻塞任务。里程碑归属不表示依赖。
                    </span>
                    <span>
                      {diagnostics.cycles.length} 循环组 ·{" "}
                      {graph.warnings.length} 不可用引用
                    </span>
                  </div>
                </>
              )}
            </>
          )}
          <footer>
            <span>
              <ShieldCheck size={13} /> PVCR 范围隔离 · 只读 GraphQL
            </span>
            <span>
              {graph.syncedAt
                ? `${graph.source === "synthetic" ? "演示生成" : "上次完整同步"} ${new Date(graph.syncedAt).toLocaleTimeString("zh-CN")}`
                : "等待授权连接"}
            </span>
          </footer>
        </section>
      </main>
      {selected && detailOpen && isGraph && (
        <aside className="detail">
          <div className="detail-header">
            <span>任务详情</span>
            <button
              className="icon-button"
              aria-label="关闭详情"
              onClick={() => setDetailOpen(false)}
            >
              <X size={19} />
            </button>
          </div>
          <div className="detail-body">
            <div className="eyebrow">
              {selected.identifier || selected.kind}
            </div>
            <h2>{selected.title}</h2>
            {diagnostics.blocked.has(selected.id) && (
              <div className="notice">有未完成的阻塞项</div>
            )}
            {diagnostics.cycles.some((g) => g.includes(selected.id)) && (
              <div className="notice error">此任务位于循环依赖中</div>
            )}
            <dl>
              {[
                ["负责人", selected.assignee],
                ["状态", selected.status],
                [
                  "优先级",
                  ["未指定", "紧急", "高", "中", "低"][selected.priority || 0],
                ],
                [
                  "项目",
                  projects.find((p) => p.id === selected.projectId)?.title,
                ],
                ["归档", selected.archived ? "已归档" : "未归档"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v || "—"}</dd>
                </div>
              ))}
            </dl>
            <div className="detail-actions">
              {selected.kind === "issue" && (
                <button
                  className="button primary"
                  onClick={() => {
                    setMode("focus");
                    setProject("all");
                    setDepth(1);
                    setQuery("");
                    setAssignee("all");
                    setStatus("all");
                  }}
                >
                  <Scan size={15} />
                  聚焦任务
                </button>
              )}
              <button
                className="button"
                onClick={() =>
                  setCollapsed((prev) => {
                    const n = new Set(prev);
                    n.has(selected.id)
                      ? n.delete(selected.id)
                      : n.add(selected.id);
                    return n;
                  })
                }
              >
                {collapsed.has(selected.id) ? "展开子项" : "折叠子项"}
              </button>
            </div>
            <h3>关系</h3>
            <div className="relation-list">
              {graph.links
                .filter(
                  (e) => e.source === selected.id || e.target === selected.id,
                )
                .map((e) => {
                  const other = graph.items.find(
                    (n) =>
                      n.id === (e.source === selected.id ? e.target : e.source),
                  );
                  return (
                    <button
                      key={e.id}
                      onClick={() => other && setSelected(other)}
                    >
                      <small>
                        {e.kind === "blocks"
                          ? e.source === selected.id
                            ? "阻塞 →"
                            : "← 被阻塞于"
                          : e.kind === "related"
                            ? "相关"
                            : e.kind === "parent"
                              ? e.source === selected.id
                                ? "子任务"
                                : "父任务"
                              : "归属"}
                      </small>
                      <span>{other?.identifier || other?.title}</span>
                    </button>
                  );
                })}
            </div>
            <h3>说明</h3>
            <p className="description">
              {selected.description || "暂无说明。"}
            </p>
            {selected.url && selected.url.startsWith("https://linear.app/") && (
              <a
                className="button"
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                在 Linear 中打开 <ArrowUpRight size={15} />
              </a>
            )}
          </div>
        </aside>
      )}
      {settings && (
        <div className="modal-backdrop" onClick={() => setSettings(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Linear 连接设置"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="关闭连接设置"
              onClick={() => setSettings(false)}
            >
              <X size={20} />
            </button>
            <div className="brand-icon">
              <Link2 size={23} />
            </div>
            <h2>连接你的 Linear</h2>
            <p>
              以自己的身份授权，仅申请 <code>read</code>。应用只请求 PVCR
              数据，不使用共享凭证。
            </p>
            <label className="field">
              公开 OAuth Client ID
              <input
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="粘贴 Client ID（不是 Secret 或 API Key）"
              />
            </label>
            <div className="callback">
              <span>注册此回调地址</span>
              <code>{callbackUrl()}</code>
            </div>
            <button
              className="button primary full"
              onClick={() => login(client).catch((e) => setError(e.message))}
            >
              使用 Linear 授权 <ArrowUpRight size={16} />
            </button>
            <p className="fine">
              Access / Refresh Token
              仅存于页面内存。刷新页面需重新授权；当前页面内自动刷新令牌。Client
              ID 是公开配置，可保存在此浏览器。
            </p>
            <div className="modal-bottom">
              <button className="button" onClick={useDemo}>
                体验合成演示
              </button>
              {connected && (
                <button
                  className="button"
                  onClick={() => {
                    reset();
                    setSettings(false);
                  }}
                >
                  <LogOut size={15} />
                  断开本地会话
                </button>
              )}
            </div>
            <small>
              断开仅清除本页会话；撤销授权请到 Linear 的 Authorized
              applications。
            </small>
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
