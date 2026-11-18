import { useState } from "react";
import { summarize } from "../analytics";
import type { Item } from "../model";

interface Props {
  projects: Item[];
  milestones: Item[];
  issues: Item[];
  blocked: ReadonlySet<string>;
  projectId: string;
  choose: (id: string) => void;
  open: (issue: Item) => void;
  explore: (mode: "hierarchy" | "dependency") => void;
}

export function ProjectExplorer({ projects, milestones, issues, blocked, projectId, choose, open, explore }: Props) {
  const [search, setSearch] = useState("");
  const [tasks, setTasks] = useState("");
  const [scope, setScope] = useState("all");
  const project = projects.find(p => p.id === projectId);
  if (!project) {
    const matches = projects.filter(p => p.title.toLowerCase().includes(search.trim().toLowerCase()));
    return <section aria-label="项目索引"><h2>项目索引</h2>
      <label className="field">搜索项目<input value={search} onChange={e=>setSearch(e.target.value)} /></label>
      <div className="project-grid">{matches.map(p => {
        const s = summarize(issues.filter(i=>i.projectId === p.id));
        return <button key={p.id} className="project-card" onClick={()=>choose(p.id)}>
          <h3>{p.title}</h3><p>{s.total} 个任务 · {s.active} 活跃 · {s.completed} 完成</p>
          <small>{milestones.filter(m=>m.projectId===p.id).length} 个里程碑 · {s.ratio===null ? "暂无任务" : Math.round(s.ratio*100)+"% 任务已完成"}</small>
        </button>;
      })}</div>{!matches.length && <p role="status">没有匹配项目。</p>}</section>;
  }
  const list = issues.filter(i=>i.projectId===project.id && !i.archived);
  const summary = summarize(list);
  const selected = list.filter(i=>(scope!=="blocked" || blocked.has(i.id)) &&
    (scope!=="active" || !["completed","canceled"].includes(i.statusType || "")) &&
    [i.identifier,i.title,i.assignee].join(" ").toLowerCase().includes(tasks.trim().toLowerCase()));
  const groups = new Map<string, Item[]>();
  for (const m of milestones.filter(m=>m.projectId===project.id)) groups.set(m.id, []);
  for (const issue of selected) {
    const id = issue.milestoneId && groups.has(issue.milestoneId) ? issue.milestoneId : "";
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(issue);
  }
  return <section aria-label="项目工作区">
    <button className="button small" onClick={()=>choose("all")}>返回项目索引</button>
    <h2>{project.title}</h2><p>{summary.active} 活跃 · {list.filter(i=>blocked.has(i.id)).length} 受阻 · {summary.overdue} 逾期</p>
    <p>{summary.states.map(([state,count])=>state+" "+count).join(" · ")}</p>
    <div className="graph-actions"><button className="button" onClick={()=>explore("hierarchy")}>项目任务层级</button>
    <button className="button" onClick={()=>explore("dependency")}>项目依赖图</button></div>
    <label className="field">搜索项目任务<input value={tasks} onChange={e=>setTasks(e.target.value)} /></label>
    <select aria-label="任务范围" value={scope} onChange={e=>setScope(e.target.value)}><option value="all">全部任务</option><option value="active">未完成任务</option><option value="blocked">受阻任务</option></select>
    {!selected.length && <p role="status">当前没有匹配任务。</p>}
    {[...groups].map(([id,rows])=><details open key={id}><summary>{milestones.find(m=>m.id===id)?.title || "未分配里程碑"} · {rows.length}</summary>
      {rows.map(i=><button className="task-row" key={i.id} onClick={()=>open(i)}><span><small>{i.identifier} · {i.assignee || "未分配"} · {i.status}</small><strong>{i.title}</strong></span>{blocked.has(i.id) && "受阻"}</button>)}</details>)}
  </section>;
}
