import { ProjectExplorer } from "./components/ProjectExplorer";
import { BuildUpdate } from "./components/BuildUpdate";
import { version } from "../package.json";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Waypoints,
  LayoutDashboard,
  FolderOpen,
  GitBranch,
  Network,
  Scan,
  Layers,
  Sun,
  Moon,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  CheckCheck,
} from "lucide-react";
import "@xyflow/react/dist/style.css";
import "./style.css";
import "./v2.css";
import { analyze, emptyGraph, type Graph, type Item } from "./model";
import { demoGraph, scaleGraph } from "./demo";
import { syncGraph, discoverIdentity, discoverTeams, boundedMap, LinearAccessError } from "./api";
import {
  configuredClient, liveOAuthAllowed,
  login,
  finishLogin,
  disconnect,
  renewSession,
  callbackUrl,
} from "./auth";
import type { TeamContext } from "./team/types";
import { TeamSession } from "./team/session";
import {
  loadProfile, importLegacyProfile, invalidReviewReferences,
  saveProfile,
  defaultProfile,
  type TeamProfile,
} from "./profiles/model";
import { ReviewCache } from "./review/api";
import {
  calculateReview,
  reviewLabels,
  type ReviewResult,
  type ReviewStatus,
} from "./review/engine";
import { GraphView } from "./graph/GraphView";
import { defaultVisibility, type GraphMode } from "./graph/semantics";
import { Hierarchy } from "./views/Hierarchy";
import { ProfileEditor } from "./components/ProfileEditor";
import { ReviewBadge } from "./components/ReviewBadge";
import { summarize, isActive, dependencyImpact } from "./analytics";
import { useDialogFocus } from "./components/DialogFocus";
import { preferenceKey, type Identity } from "./team/identity";
const modes = [
  ["overview", "团队总览", LayoutDashboard],
  ["project", "项目探索", FolderOpen],
  ["hierarchy", "层级视图", GitBranch],
  ["dependency", "依赖视图", Network],
  ["focus", "聚焦模式", Scan],
  ["combined", "组合视图", Layers],
  ["reviews", "审阅队列", CheckCheck],
] as const;
type Mode = (typeof modes)[number][0];
const initialFilters = {
  subset: "all",
  project: "all",
  milestone: "all",
  assignee: "all",
  role: "all",
  status: "all",
  workstream: "all",
  priority: "all",
  review: "all",
  reviewer: "all",
};
function App() {
  const [graph, setGraph] = useState<Graph>(emptyGraph),
    [teams, setTeams] = useState<TeamContext[]>([]),
    [team, setTeam] = useState<TeamContext | null>(null),
    [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [mode, setMode] = useState<Mode>("overview"),
    [selected, setSelected] = useState<Item | null>(null),
    [detail, setDetail] = useState(false),
    [settings, setSettings] = useState(false),
    [profiles, setProfiles] = useState(false),
    [client, setClient] = useState(configuredClient),
    [dark, setDark] = useState(localStorage.getItem("lge-theme") === "dark"),
    [profile, setProfile] = useState<TeamProfile>(defaultProfile("", "")),
    [reviews, setReviews] = useState<Record<string, ReviewResult>>({}),
    [reviewBusy, setReviewBusy] = useState(false),
    [reviewError, setReviewError] = useState(""),
    [reviewSearch, setReviewSearch] = useState(""),
    [reviewProject, setReviewProject] = useState("all"),
    [reviewStatus, setReviewStatus] = useState<ReviewStatus | "all">("all"),
    [reviewerFilter, setReviewerFilter] = useState("all"),
    [filter, setFilter] = useState(initialFilters),
    [query, setQuery] = useState(""),
    [archived, setArchived] = useState(false),
    [completed, setCompleted] = useState(true),
    [visibility, setVisibility] = useState(defaultVisibility),
    [depth, setDepth] = useState(1),
    [direction, setDirection] = useState<"both" | "up" | "down">("both");
  useDialogFocus(settings || profiles, () => {setSettings(false); setProfiles(false);});
  const session = useRef(new TeamSession()),
    reviewAbort = useRef(new AbortController()),
    cache = useRef(new ReviewCache()),
    teamRef = useRef<TeamContext | null>(null),
    generation = useRef(0),
    reviewGen = useRef(0);
  const identity = useRef<Identity | null>(null);
  const discoveryAbort = useRef(new AbortController());
  const clearReviews = (clearData = true) => {
    reviewAbort.current.abort();
    reviewAbort.current = new AbortController();
    cache.current.clear();
    reviewGen.current++;
    setReviewBusy(false);
    if (clearData) setReviews({});
    setReviewError("");
  };
  const clearTeamView = () => {
    session.current.clear();
    generation.current++;
    clearReviews();
    teamRef.current = null;
    setTeam(null);
    setGraph(emptyGraph());
    setProfile(defaultProfile("", ""));
    setProfiles(false);
    setSelected(null);
    setDetail(false);
    setReviewSearch("");
    setReviewProject("all");
    setReviewStatus("all");
    setReviewerFilter("all");
    setFilter(initialFilters);
    setQuery("");
    setMode("overview");
    setDepth(1);
  };
  const load = async (next: TeamContext, switching = false) => {
    const owner = identity.current;
    if (!owner) return;
    if (switching) clearTeamView();
    const guard = session.current.switch();
    const epoch = ++generation.current;
    if (!switching) clearReviews(false);
    setBusy(true);
    setError("");
    if (switching) {
      teamRef.current = next;
      setTeam(next);
      setProfile(loadProfile(owner, next.id, next.key));
      localStorage.setItem(preferenceKey(owner, "selected-team"), next.id);
    }
    try {
      const data = await syncGraph(next, undefined, guard.signal, (s) => {
        if (guard.current()) setProgress(s);
      });
      if (guard.current() && epoch === generation.current) {
        setGraph(data);
        setReviews({});
        setSelected((old) => data.items.find((n) => n.id === old?.id) || null);
      }
    } catch (e) {
      if (guard.current()) reportFailure(e);
    } finally {
      if (guard.current()) setBusy(false);
    }
  };
  const discover = async () => {
    discoveryAbort.current.abort();
    const c = new AbortController();
    discoveryAbort.current = c;
    clearTeamView();
    identity.current = null;
    setTeams([]);
    setError("");
    setBusy(true);
    setProgress("发现可访问的团队…");
    try {
      const owner = await discoverIdentity(undefined, c.signal);
      const all = await discoverTeams(undefined, c.signal);
      c.signal.throwIfAborted();
      identity.current = owner;
      setTeams(all);
      const restored =
        all.find((t) => t.id === localStorage.getItem(preferenceKey(owner, "selected-team"))) ||
        all[0];
      if (restored) await load(restored, true);
      else {
        setTeam(null);
        teamRef.current = null;
        setGraph(emptyGraph());
        setBusy(false);
      }
    } catch (e) {
      if (!c.signal.aborted) {
        reportFailure(e);
        setBusy(false);
      }
    }
  };
  useEffect(() => {
    finishLogin()
      .then((ok) => {
        if (ok) {
          setConnected(true);
          void discover();
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      session.current.clear();
      reviewAbort.current.abort();
      discoveryAbort.current.abort();
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("lge-theme", dark ? "dark" : "light");
  }, [dark]);
  const reset = () => {
    discoveryAbort.current.abort();
    clearTeamView();
    disconnect();
    identity.current = null;
    setProgress("");
    setConnected(false);
    setTeams([]);
    setBusy(false);
    setError("");
    setMode("overview");
  };
  const reportFailure = (error: unknown) => {
    if (error instanceof LinearAccessError) reset();
    setError(error instanceof Error ? error.message : "读取失败，请重试。");
  };
  const issues = useMemo(
      () => graph.items.filter((n) => n.kind === "issue"),
      [graph],
    ),
    projects = graph.items.filter((n) => n.kind === "project"),
    milestones = graph.items.filter((n) => n.kind === "milestone");
  const diagnostics = useMemo(() => analyze(graph), [graph]),
    summary = useMemo(() => summarize(graph.items), [graph]);
  const invalidPolicy = useMemo(() => invalidReviewReferences(profile.reviewPolicy, graph), [profile, graph]);
  const reviewResult = (n: Item): ReviewResult =>
    invalidPolicy ? {status:"Verification Required",required:profile.reviewPolicy?.requiredApprovals || 0,approvals:0,decisions:[],warning:invalidPolicy} :
    reviews[n.id] || calculateReview(profile.reviewPolicy, n.assigneeId, [], undefined, n.stateId);
  const isInReview = (n: Item) => {
    if (n.kind !== "issue" || n.archived) return false;
    const stateName = (graph.states?.find((state) => state.id === n.stateId)?.name || n.status || "").trim().toLowerCase();
    return Boolean(profile.reviewPolicy?.inReviewStateIds.includes(n.stateId || "") || stateName === "in review" || stateName === "review");
  };
  const reviewCandidates = useMemo(() => issues.filter(isInReview), [issues, graph.states, profile.reviewPolicy]);
  const workstreams = (n: Item) => {
    const values = (n.labels || [])
      .map((id) => profile.workstreamLabelMap[id])
      .filter(Boolean);
    return values.length ? values : [profile.unmappedWorkstream];
  };
  const visible = useMemo(
    () =>
      issues.filter(
        (n) =>
          (filter.subset !== "blocked" || diagnostics.blocked.has(n.id)) &&
          (filter.subset !== "active" || isActive(n)) &&
          (filter.subset !== "done" || n.statusType === "completed") &&
          (archived || !n.archived) &&
          (completed ||
            !["completed", "canceled"].includes(n.statusType || "")) &&
          (filter.project === "all" || n.projectId === filter.project) &&
          (filter.milestone === "all" || n.milestoneId === filter.milestone) &&
          (filter.assignee === "all" ||
            (n.assigneeId || "none") === filter.assignee) &&
          (filter.role === "all" ||
            (profile.memberRoleMap[n.assigneeId || ""] || []).includes(
              filter.role,
            )) &&
          (filter.status === "all" || n.stateId === filter.status) &&
          (filter.priority === "all" ||
            String(n.priority || 0) === filter.priority) &&
          (filter.workstream === "all" ||
            workstreams(n).includes(filter.workstream)) &&
          (filter.review === "all" ||
            reviewResult(n).status === filter.review) &&
          (filter.reviewer === "all" ||
            reviewResult(n).decisions.some(
              (d) => d.reviewerId === filter.reviewer,
            )),
      ),
    [graph, filter, archived, completed, profile, reviews],
  );
  const queue = reviewCandidates.filter((n) =>
    (reviewProject === "all" || n.projectId === reviewProject) &&
    (reviewStatus === "all" || reviewResult(n).status === reviewStatus) &&
    (reviewerFilter === "all" || reviewResult(n).decisions.some((d) => d.reviewerId === reviewerFilter)) &&
    `${n.identifier} ${n.title} ${n.assignee || ""}`.toLowerCase().includes(reviewSearch.trim().toLowerCase())
  );
  const matchesSearch = (n: Item) => `${n.identifier} ${n.title}`.toLowerCase().includes(query.trim().toLowerCase());
  const resetFilters = () => {
    setQuery(""); setFilter(initialFilters); setCompleted(true); setArchived(false);
  };
  const filterCount = Object.values(filter).filter(value => value !== "all").length +
    Number(Boolean(query.trim())) + Number(archived) + Number(!completed);
  const readReviews = async (targets: Item[], force = false) => {
    if (!team || invalidPolicy || graph.source === "synthetic" || !profile.reviewPolicy?.enabled)
      return;
    const t = team;
    const policy = profile.reviewPolicy;
    if (force) clearReviews(false);
    const token = reviewGen.current;
    const signal = reviewAbort.current.signal;
    setReviewBusy(true);
    setReviewError("");
    try {
      const rs = await boundedMap(
        targets,
        3,
        (n) => cache.current.load(t, n, policy, signal),
        signal,
      );
      if (teamRef.current?.id !== t.id || token !== reviewGen.current) return;
      setReviews((prev) => ({
        ...prev,
        ...Object.fromEntries(targets.map((n, i) => [n.id, rs[i]])),
      }));
    } catch (e) {
      if (signal.aborted || token !== reviewGen.current) return;
      if (e instanceof LinearAccessError) reportFailure(e);
      else setReviewError(
          "审阅读取未完整成功，已保留上次完整结果。" + (e as Error).message,
        );
    } finally {
      if (teamRef.current?.id === t.id && token === reviewGen.current)
        setReviewBusy(false);
    }
  };
  useEffect(() => {
    if (!graph.syncedAt || !profile.reviewPolicy?.enabled) return;
    if (reviewCandidates.length) void readReviews(reviewCandidates);
  }, [graph.syncedAt, profile, reviewCandidates]);
  const select = (n: Item) => {
    setSelected(n);
    setDetail(true);
    if (n.kind === "issue" && isInReview(n) && !reviews[n.id]) void readReviews([n]);
  };
  const updateFilter = (key: keyof typeof filter, value: string) =>
    setFilter((f) => ({ ...f, [key]: value }));
  const title = modes.find((m) => m[0] === mode)![1];
  const isGraph = ["dependency", "focus", "combined"].includes(mode);
  const demo = () => {
    reset();
    const t = { id: "synthetic-team", key: "DEMO", name: "合成演示团队" };
    teamRef.current = t;
    setTeam(t);
    setTeams([t]);
    setProfile(defaultProfile(t.id, t.key));
    setGraph({
      ...demoGraph(),
      teamId: t.id,
      members: [
        { id: "a", name: "研究员 A" },
        { id: "b", name: "研究员 B" },
      ],
    });
    setSettings(false);
  };
  const options = (
    name: string,
    key: keyof typeof filter,
    values: { id: string; name: string }[],
  ) => (
    <select
      aria-label={name}
      value={filter[key]}
      onChange={(e) => updateFilter(key, e.target.value)}
    >
      <option value="all">{name}</option>
      {values.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      ))}
    </select>
  );
  return (
    <div className="app v2-app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Waypoints size={22} />
          </div>
          <div>
            <b>Graph Explorer</b>
            <small>LINEAR · v{version}</small>
          </div>
        </div>
        <label className="team-selector">
          当前团队
          <select
            aria-label="选择团队"
            disabled={
              !teams.length || (!connected && graph.source !== "synthetic")
            }
            value={team?.id || ""}
            onChange={(e) => {
              const next = teams.find((t) => t.id === e.target.value);
              if (next && next.id !== team?.id) void load(next, true);
            }}
          >
            <option value="" disabled>
              连接后选择团队
            </option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.key} · {t.name}
              </option>
            ))}
          </select>
        </label>
        <nav>
          {modes.map(([id, label, Icon]) => (
            <button
              key={id}
              aria-label={label}
              aria-current={mode === id ? "page" : undefined}
              title={label}
              className={mode === id ? "active" : ""}
              onClick={() => { if (id === "project") resetFilters(); setMode(id); }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="nav-label">PROJECTS</div>
        <div className="project-nav">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                resetFilters(); updateFilter("project", p.id);
                setMode("project");
              }}
            >
              {p.title}
            </button>
          ))}
        </div>
        <div className="sidebar-foot">
          <ShieldCheck size={17} />
          <span>所选团队隔离 · 只读</span>
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            Workspace / {team?.key || "选择团队"} / {title}
          </div>
          <div className="header-actions">
            <button
              className="icon-button"
              aria-label="切换深浅色"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="button small"
              disabled={!team}
              onClick={() => setProfiles(true)}
            >
              视图与审阅设置
            </button>
            <button className="button small" onClick={() => setSettings(true)}>
              <SlidersHorizontal size={14} />
              连接设置
            </button>
          </div>
        </header>
        <section className="content">
          <BuildUpdate />
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {team?.name || "UNIVERSAL TEAM INTELLIGENCE"}
              </div>
              <h1>
                {title}
                <span className="readonly">READ ONLY</span>
              </h1>

            </div>
            <button
              className="button primary"
              disabled={busy || graph.source === "synthetic"}
              onClick={() =>
                connected ? (team ? load(team) : discover()) : setSettings(true)
              }
            >
              <RefreshCw size={15} className={busy ? "spin" : ""} />
              {busy ? "同步中…" : "刷新数据"}
            </button>
          </div>
          {graph.source === "synthetic" && (
            <div className="notice demo">
              合成演示数据，不代表真实同步。
              {([20, 50, 100, 200] as const).map((count) => <button key={count} onClick={() => {
                setSelected(null);
                setDetail(false);
                setQuery("");
                setFilter(initialFilters);
                setGraph(scaleGraph(count));
              }}>{count} 节点压力图</button>)}
              <button onClick={reset}>退出演示</button>
            </div>
          )}
          {busy && (
            <div className="notice" role="status">
              {progress}
              <button
                onClick={() => {
                  discoveryAbort.current?.abort();
                  session.current.clear();
                  generation.current++;
                  setBusy(false);
                }}
              >
                取消
              </button>
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error} {graph.syncedAt ? "仍显示上次成功快照。" : ""}
            </div>
          )}
          {!graph.syncedAt ? (
            <div className="welcome v2-welcome">
              <div className="welcome-copy">
                <span className="pill">自己的身份 · 当前团队 · 实时只读</span>
                <h2>
                  {busy ? "正在准备团队数据…" : "从团队全貌，到下一步行动。"}
                </h2>
                <p>
                  {connected
                    ? teams.length
                      ? "请选择团队。只有完整同步成功后才展示统计。"
                      : "当前身份没有可访问的团队，或团队发现尚未完成。"
                    : "连接 Linear 后自动发现可访问团队。角色、工作流和审阅规则都由你配置。"}
                </p>
                <div className="welcome-actions">
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => (connected ? discover() : setSettings(true))}
                  >
                    {connected ? "重新发现团队" : "连接 Linear"}
                  </button>
                  <button className="button" disabled={busy} onClick={demo}>
                    体验合成演示
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {(isGraph || mode === "hierarchy") && (
                <div className="filter-bar">
                  <label className="search">
                    <input
                      aria-label="搜索任务"
                      placeholder="搜索并定位任务…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  {options(
                    "全部项目",
                    "project",
                    projects.map((p) => ({ id: p.id, name: p.title })),
                  )}
                  {options(
                    "全部里程碑",
                    "milestone",
                    milestones.map((p) => ({ id: p.id, name: p.title })),
                  )}
                  {options("全部负责人", "assignee", [
                    { id: "none", name: "未分配" },
                    ...(graph.members || []),
                  ])}
                  {options("全部状态", "status", graph.states || [])}
                  <button className="button small" onClick={resetFilters} disabled={!filterCount}>清空筛选（{filterCount}）</button>
                  <details className="advanced"><summary>更多筛选</summary><div>
                  {options("任务范围", "subset", [{id:"active",name:"活跃任务"},{id:"blocked",name:"有未完成前置项"},{id:"done",name:"已完成任务"}])}
                  {options("全部角色", "role", profile.roles)}
                  {options(
                    "全部工作流",
                    "workstream",
                    [
                      ...new Set([
                        profile.unmappedWorkstream,
                        ...Object.values(profile.workstreamLabelMap).filter(
                          Boolean,
                        ),
                      ]),
                    ].map((x) => ({ id: x, name: x })),
                  )}
                  {options(
                    "全部优先级",
                    "priority",
                    ["未指定", "紧急", "高", "中", "低"].map((name, i) => ({
                      id: String(i),
                      name,
                    })),
                  )}
                  <label>
                    <input
                      type="checkbox"
                      checked={archived}
                      onChange={(e) => setArchived(e.target.checked)}
                    />
                    已归档
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={completed}
                      onChange={(e) => setCompleted(e.target.checked)}
                    />
                    已完成
                  </label>
                  </div></details>
                </div>
              )}
              {mode === "project" && <ProjectExplorer key={JSON.stringify([team?.id,filter.project])} projects={projects} milestones={milestones} issues={issues}
                blocked={diagnostics.blocked} projectId={filter.project} open={select} choose={id=>updateFilter("project",id)}
                explore={(next, projectId) => { setFilter({ ...initialFilters, project: projectId }); setMode(next); }} />}
              {mode === "overview" && (
                <>
                  <div className="stats">
                    {[
                      [projects.length, "团队项目", "projects"],
                      [summary.active, "活跃任务", "active"],
                      [diagnostics.blocked.size, "有未完成前置项", "blocked"],
                      [summary.completed, "已完成任务", "done"],
                    ].map(([n, label, subset]) => (
                      <button className="stat" key={label} onClick={() => {
                        resetFilters();
                        if (subset === "projects") {setMode("project"); return;}
                        setFilter({...initialFilters, subset: String(subset)});
                        setMode("hierarchy");
                      }}>
                        <span>{label}</span>
                        <strong>{n}</strong>
                        <small>
                          完整快照 ·{" "}
                          {graph.source === "live" ? "实时来源" : "合成数据"}
                        </small>
                      </button>
                    ))}
                  </div>
                  <div className="overview-bottom">
                    <section className="health">
                      <h3>任务状态与进展</h3>
                      <p>
                        {summary.completed} 完成 / {summary.canceled} 取消 /{" "}
                        {summary.remaining} 剩余
                      </p>
                      <p>
                        任务完成比例：
                        {summary.ratio === null
                          ? "无任务数据"
                          : `${Math.round(summary.ratio * 100)}%`}
                        （不代表工程完成度）
                      </p>
                      <div className="distribution">
                        {summary.states.map(([s, n]) => (
                          <span key={s}>
                            {s} <b>{n}</b>
                          </span>
                        ))}
                      </div>
                      <p>
                        逾期 {summary.overdue} · 未分配 {summary.unassigned} ·
                        循环组 {diagnostics.cycles.length} · 孤立任务{" "}
                        {diagnostics.isolated.length}
                      </p>
                      <p>
                        不可用引用提示 {graph.warnings.length}
                        ；不自动读取外部任务，不计算关键路径。
                      </p>
                      <button
                        className="button small"
                        onClick={() => setMode("reviews")}
                      >
                        查看审阅队列
                      </button>
                    </section>
                    <section className="workload">
                      <h3>活跃任务分布</h3>
                      {[
                        ...new Set(issues.map((n) => n.assigneeId || "none")),
                      ].map((id) => {
                        const list = issues.filter(
                          (n) => (n.assigneeId || "none") === id && isActive(n),
                        );
                        return (
                          <div key={id}>
                            <span>
                              {graph.members?.find((m) => m.id === id)?.name ||
                                issues.find((n) => n.assigneeId === id)
                                  ?.assignee ||
                                "未分配"}
                            </span>
                            <b>
                              {list.length} 活跃 ·{" "}
                              {
                                list.filter((n) => n.statusType === "started")
                                  .length
                              }{" "}
                              进行 ·{" "}
                              {
                                list.filter((n) =>
                                  diagnostics.blocked.has(n.id),
                                ).length
                              }{" "}
                              阻塞 ·{" "}
                              {
                                list.filter((n) =>
                                  profile.reviewPolicy?.inReviewStateIds.includes(
                                    n.stateId || "",
                                  ),
                                ).length
                              }{" "}
                              待审阅
                              <br />
                              优先级{" "}
                              {["紧急", "高", "中", "低"]
                                .map(
                                  (label, i) =>
                                    `${label} ${list.filter((n) => n.priority === i + 1).length}`,
                                )
                                .join(" / ")}
                            </b>
                          </div>
                        );
                      })}
                      <small>任务数不等同实际工作量或产能。</small>
                    </section>
                  </div>
                  <h2 id="project-list" className="section-title">项目空间</h2>
                  <div className="project-grid">
                    {projects.map((p) => {
                      const s = summarize(
                        issues.filter((n) => n.projectId === p.id),
                      );
                      return (
                        <button
                          className="project-card"
                          key={p.id}
                          onClick={() => {
                            resetFilters(); updateFilter("project", p.id);
                            setMode("project");
                          }}
                        >
                          <FolderOpen size={23} />
                          <h3>{p.title}</h3>
                          <p>
                            {s.total} 个任务 · {s.completed} 完成 ·{" "}
                            {s.remaining} 剩余
                          </p>
                          <div className="progress-track">
                            <i style={{ width: `${(s.ratio || 0) * 100}%` }} />
                          </div>
                        </button>
                      );
                    })}
                    {!projects.length && (
                      <div className="health">
                        此团队没有项目。未归属项目的任务仍可在图谱和层级视图中查看。
                      </div>
                    )}
                  </div>
                  <div className="overview-bottom">
                    <section className="health">
                      <h3>里程碑进度</h3>
                      {milestones.map((m) => {
                        const s = summarize(
                          issues.filter((n) => n.milestoneId === m.id),
                        );
                        return (
                          <button
                            className="milestone-row"
                            key={m.id}
                            onClick={() => {
                              setFilter({ ...initialFilters, milestone: m.id });
                              setMode("hierarchy");
                            }}
                          >
                            <span>{m.title}</span>
                            <b>
                              {s.completed}/{s.total}
                            </b>
                          </button>
                        );
                      })}
                    </section>
                    <section className="health">
                      <h3>最近更新</h3>
                      {[...issues]
                        .sort((a, b) =>
                          (b.updatedAt || "").localeCompare(a.updatedAt || ""),
                        )
                        .slice(0, 6)
                        .map((n) => (
                          <button
                            className="milestone-row"
                            key={n.id}
                            onClick={() => select(n)}
                          >
                            {n.identifier} · {n.title}
                          </button>
                        ))}
                    </section>
                  </div>
                </>
              )}
              {mode === "hierarchy" && filterCount > 0 && !visible.some(matchesSearch) ? (
                <p role="status">当前筛选下没有匹配任务。</p>
              ) : mode === "hierarchy" && (
                <Hierarchy
                  graph={graph}
                  items={visible.filter(
                    (n) =>
                      !query ||
                      `${n.identifier} ${n.title}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                  )}
                  onSelect={select}
                />
              )}
              {isGraph && (
                <>
                  <div className="graph-actions">
                    {mode === "combined" &&
                      (
                        ["blocks", "parent", "related", "grouping"] as const
                      ).map((k) => (
                        <label key={k}>
                          <input
                            type="checkbox"
                            checked={visibility[k]}
                            onChange={(e) =>
                              setVisibility((v) => ({
                                ...v,
                                [k]: e.target.checked,
                              }))
                            }
                          />
                          {
                            {
                              blocks: "阻塞",
                              parent: "父子",
                              related: "一般相关",
                              grouping: "项目 / 里程碑分组",
                            }[k]
                          }
                        </label>
                      ))}
                    {mode === "focus" && (
                      <>
                        <select aria-label="聚焦任务" value={selected?.id || ""} onChange={(e) => {
                          const item = issues.find((n) => n.id === e.target.value);
                          if (item) { setSelected(item); setDepth(1); }
                        }}>
                          <option value="">请选择任务</option>
                          {issues.map((n) => <option key={n.id} value={n.id}>{n.identifier} · {n.title}</option>)}
                        </select>
                        <span>
                          聚焦 {selected?.identifier || "请点击一个任务"}
                        </span>
                        <select
                          aria-label="聚焦方向"
                          value={direction}
                          onChange={(e) => setDirection(e.target.value as any)}
                        >
                          <option value="both">上下游与父子</option>
                          <option value="up">上游</option>
                          <option value="down">下游</option>
                        </select>
                        <button
                          className="button small"
                          onClick={() => setDepth((d) => d + 1)}
                        >
                          扩展一层（{depth}）
                        </button>
                        <button
                          className="button small"
                          onClick={() => setDepth(1)}
                        >
                          收起到一层
                        </button>
                      </>
                    )}
                    {mode === "dependency" && (
                      <span>
                        仅展示真实阻塞关系 · 前置 → 被阻塞 · Related To
                        不参与布局
                      </span>
                    )}
                  </div>
                  {diagnostics.cycles.length > 0 && (
                    <div className="notice error">
                      存在 {diagnostics.cycles.length} 组循环依赖；图谱不是
                      DAG，请检查循环节点。
                    </div>
                  )}
                  <GraphView
                    blocked={diagnostics.blocked}
                    graph={graph}
                    items={visible}
                    mode={mode as GraphMode}
                    visibility={visibility}
                    selected={selected?.id}
                    onSelect={select}
                    dark={dark}
                    depth={depth}
                    direction={direction}
                    reviews={Object.fromEntries(
                      issues.map((n) => [n.id, reviewResult(n)]),
                    )}
                    query={query}
                  />
                </>
              )}
              {mode === "reviews" && (
                <section className="review-queue" aria-label="审阅队列">
                  <div className="review-queue-heading">
                    <div><span className="eyebrow">REVIEW INTELLIGENCE</span><h2>审阅队列</h2>
                      <p>自动发现当前处于 In Review 的任务。是否通过仍须按当前账号的审阅规则和本轮状态历史核验。</p></div>
                    <button className="button small" disabled={reviewBusy || !profile.reviewPolicy?.enabled || !reviewCandidates.length}
                      onClick={() => readReviews(reviewCandidates, true)}>{reviewBusy ? "读取中…" : "刷新全部审阅证据"}</button>
                  </div>
                  <div className="review-queue-summary">
                    <div><span>In Review 候选</span><strong>{reviewCandidates.length}</strong></div>
                    <div><span>当前筛选</span><strong>{queue.length}</strong></div>
                    <div><span>审阅通过</span><strong>{reviewCandidates.filter(n => reviewResult(n).status === "Review Passed").length}</strong></div>
                    <div><span>需要处理</span><strong>{reviewCandidates.filter(n => reviewResult(n).status !== "Review Passed").length}</strong></div>
                  </div>
                  <div className="review-queue-controls">
                    <input aria-label="搜索审阅任务" placeholder="搜索任务编号或标题…" value={reviewSearch} onChange={e=>setReviewSearch(e.target.value)} />
                    <select aria-label="审阅项目筛选" value={reviewProject} onChange={e=>setReviewProject(e.target.value)}>
                      <option value="all">全部项目</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                    <select aria-label="审阅结果筛选" value={reviewStatus} onChange={e=>setReviewStatus(e.target.value as ReviewStatus|"all")}>
                      <option value="all">全部审阅结果</option>{Object.entries(reviewLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}
                    </select>
                    <select aria-label="审阅人筛选" value={reviewerFilter} onChange={e=>setReviewerFilter(e.target.value)}>
                      <option value="all">全部审阅人</option>{(graph.members||[]).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  {reviewError && <div className="notice error" role="alert">{reviewError}</div>}
                  {!profile.reviewPolicy?.enabled && <div className="notice">已发现 In Review 任务，但当前账号尚未启用审阅规则。你仍可浏览候选任务；配置审阅人和状态后，应用才会计算评论证据。</div>}
                  {profile.reviewPolicy?.enabled && !profile.reviewPolicy.eligibleReviewerIds.length && <div className="notice">尚未选择合格审阅人。当前不会有任何成员的评论被计为批准。</div>}
                  <details className="review-howto"><summary>如何在 Linear 提交审阅意见</summary>
                    <p>在当前轮次的顶层任务评论中单独写出决定，下一行可以补充说明。</p>
                    <p>批准：Approved / Approved with comments；要求修改：Request changes / Changes requested；暂缓：Hold / On hold；无法判断：Unable to assess。</p>
                    <p>每位审阅人只保留本轮最新决定；重新进入 In Review 后，旧轮次评论不会自动沿用。</p>
                  </details>
                  <div className="task-list review-task-list">
                    {!reviewCandidates.length && <div className="project-empty" role="status">当前团队没有检测到 In Review 任务。请检查 Linear 状态名称并刷新团队数据。</div>}
                    {reviewCandidates.length>0&&!queue.length && <div className="project-empty" role="status">没有符合当前队列筛选的任务。</div>}
                    {queue.map(n=><button className="task-row review-task-row" key={n.id} onClick={()=>select(n)}>
                      <span className="review-task-main"><small>{n.identifier} · {projects.find(p=>p.id===n.projectId)?.title||"未归属项目"} · {n.assignee||"未分配负责人"}</small>
                        <strong>{n.title}</strong><small>{reviewResult(n).boundary?"本轮开始 "+new Date(reviewResult(n).boundary!).toLocaleString("zh-CN"):"本轮边界尚未确认"}</small></span>
                      <ReviewBadge result={reviewResult(n)}/>
                    </button>)}
                  </div>
                </section>
              )}
            </>
          )}
          <footer className="app-footer">
            <div className="app-footer-status">
              <span>
                <ShieldCheck size={13} />
                所选团队隔离 · 只读 GraphQL · v{version} {import.meta.env.VITE_BUILD_SHA} · {location.hostname.endsWith(".vercel.app") ? "Vercel" : location.hostname.endsWith(".github.io") ? "GitHub Pages" : location.hostname.endsWith(".chatgpt.site") ? "ChatGPT Site" : "本地环境"}
              </span>
              <span>
                {graph.syncedAt
                  ? `上次完整同步 ${new Date(graph.syncedAt).toLocaleString("zh-CN")}`
                  : "尚未完成同步"}
              </span>
            </div>
            <p className="app-footer-legal">
              © 2026 Horace Chan · 版权所有 · 本项目依据{" "}
              <a
                href="https://github.com/HoraceCh/Linear-Gragh-Explorer/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
              >
                MIT License
              </a>{" "}
              开源
            </p>
          </footer>
        </section>
      </main>
      {selected && detail && (
        <aside className="detail v2-detail">
          <div className="detail-header">
            <span>{selected.identifier} · 任务详情</span>
            <button className="button small" onClick={() => setDetail(false)}>
              关闭详情
            </button>
          </div>
          <div className="detail-body">
            <h2>{selected.title}</h2>
            <ReviewBadge result={reviewResult(selected)} />
            <dl>
              {[
                ["负责人", selected.assignee],
                ["状态", selected.status],
                ["周期", selected.cycleNumber == null ? undefined : String(selected.cycleNumber)],
                [
                  "项目",
                  projects.find((p) => p.id === selected.projectId)?.title,
                ],
                [
                  "里程碑",
                  milestones.find((m) => m.id === selected.milestoneId)?.title,
                ],
                [
                  "优先级",
                  ["未指定", "紧急", "高", "中", "低"][selected.priority || 0],
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v || "—"}</dd>
                </div>
              ))}
            </dl>
            <button
              className="button primary"
              onClick={() => {
                setMode("focus");
                setDepth(1);
                setFilter(initialFilters);
              }}
            >
              聚焦此任务
            </button>
            <details open key={selected.id + "-relations"}><summary>关系与依赖影响</summary>
            {(() => {
              const a = dependencyImpact(graph, selected.id);
              return (
                <p>
                  直接阻塞源 {a.direct.length} · 传递上游 {a.upstream.length} ·
                  下游影响 {a.downstream.length}
                </p>
              );
            })()}
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
                    <button key={e.id} onClick={() => other && select(other)}>
                      <small>
                        {e.kind === "blocks"
                          ? e.source === selected.id
                            ? "阻塞 →"
                            : "← 被阻塞于"
                          : e.kind === "parent"
                            ? e.source === selected.id
                              ? "子任务"
                              : "父任务"
                            : e.kind === "related"
                              ? "一般相关"
                              : "归属"}
                      </small>
                      <span>
                        {other?.identifier ||
                          other?.title ||
                          "外部或不可用引用"}
                      </span>
                    </button>
                  );
                })}
            </div>
            </details><details open key={selected.id + "-review"}><summary>审阅证据</summary>
            {reviewError && <p role="alert">{reviewError}</p>}
            {reviewResult(selected).ignored && Object.entries(reviewResult(selected).ignored || {}).map(([reason,count]) => <p key={reason}>{reason} · {count}</p>)}
            {reviewResult(selected).warning && (
              <p>{reviewResult(selected).warning}</p>
            )}
            <button
              className="button small"
              disabled={reviewBusy || !profile.reviewPolicy?.enabled}
              onClick={() => readReviews([selected], true)}
            >
              刷新本任务审阅
            </button>
            <p>
              {reviewResult(selected).boundary
                ? `本轮开始 ${new Date(reviewResult(selected).boundary!).toLocaleString("zh-CN")}`
                : "轮次边界尚未确认"}
            </p>
            {reviewResult(selected).decisions.map((d) => (
              <div className="review-decision" key={d.reviewerId}>
                <b>
                  {d.name} · {({approve:"批准",requestChanges:"要求修改",hold:"暂缓",unableToAssess:"无法判断"} as const)[d.decision]}
                </b>
                <small>{new Date(d.at).toLocaleString("zh-CN")}</small>
                <p>{d.excerpt}</p>
              </div>
            ))}
            </details><details key={selected.id + "-description"}><summary>任务说明</summary>
            <p className="description">{selected.description || "暂无说明"}</p></details>
            <small>完整同步于 {new Date(graph.syncedAt).toLocaleString("zh-CN")}</small>
            {selected.url?.startsWith("https://linear.app/") && (
              <a
                className="button"
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                在 Linear 中打开 ↗
              </a>
            )}
          </div>
        </aside>
      )}
      {profiles && team && (
        <ProfileEditor
          key={team.id}
          value={profile}
          onLegacy={identity.current && localStorage.getItem(`lge-profile:${team.id}`) !== null ? () => {
            if (!identity.current || teamRef.current?.id !== team.id) throw new Error("会话已改变。");
            const restored = importLegacyProfile(identity.current, team.id);
            clearReviews(); setProfile(restored);
            return restored;
          } : undefined}
          graph={graph}
          onClose={() => setProfiles(false)}
          onSave={(p) => {
            clearReviews();
            if (identity.current) saveProfile(identity.current, p);
            setProfile(p);
          }}
        />
      )}
      {settings && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Linear 连接设置"
          >
            <button
              className="modal-close button small"
              onClick={() => setSettings(false)}
            >
              关闭
            </button>
            <h2>连接你的 Linear</h2>
            <p>
              仅申请
              read。登录后先发现团队，再读取你明确选择的团队。访问范围仍受
              Linear 权限控制。
            </p>
            <label className="field">
              公开 OAuth Client ID
              <input
                aria-label="公开 OAuth Client ID"
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </label>
            <div className="callback">
              <span>回调地址</span>
              <code>{callbackUrl()}</code>
            </div>
            <button
              className="button primary full"
              disabled={!liveOAuthAllowed()}
              onClick={() => login(client).catch((e) => setError(e.message))}
            >
              {liveOAuthAllowed() ? "使用 Linear 授权" : "当前地址仅支持合成演示"}
            </button>
            <p className="fine">
              令牌仅保存在内存；重载后需重新授权。Team
              选择和本地配置会保留，任务与评论不会写入本地存储。
            </p>
            <div className="settings-buttons">
              {connected && (
                <>
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        await renewSession();
                        setSettings(false);
                        if (team) await load(team);
                      } catch (e) {
                        reportFailure(e);
                      }
                    }}
                  >
                    刷新授权并同步
                  </button>
                  <button
                    className="button"
                    onClick={() => {
                      reset();
                      setSettings(false);
                    }}
                  >
                    断开本地会话
                  </button>
                </>
              )}
              <button className="button" onClick={demo}>
                体验合成演示
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
