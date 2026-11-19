import { useState } from "react";
import { summarize } from "../analytics";
import type { Item } from "../model";

interface Props {
  projects: Item[]; milestones: Item[]; issues: Item[]; blocked: ReadonlySet<string>;
  projectId: string; choose: (id: string) => void; open: (issue: Item) => void;
  explore: (mode: "hierarchy" | "dependency", projectId: string) => void;
}
const tone=(type?:string)=>type==="completed"?"done":type==="canceled"?"cancelled":type==="started"?"active":"todo";
const shortDate=(value?:string)=>{
 if(!value)return "";
 const date=new Date(value);
 return Number.isNaN(date.getTime())?"":date.toLocaleDateString("zh-CN",{month:"numeric",day:"numeric"});
};

export function ProjectExplorer({projects,milestones,issues,blocked,projectId,choose,open,explore}:Props){
 const [search,setSearch]=useState(""),[tasks,setTasks]=useState(""),[scope,setScope]=useState("all"),[sort,setSort]=useState("updated");
 const project=projects.find(p=>p.id===projectId);
 if(!project){
  const matches=projects.filter(p=>(p.title+" "+(p.description||"")).toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="project-explorer project-index" aria-label="项目索引">
   <div className="project-index-heading"><div><span className="eyebrow">WORKSPACE / PROJECTS</span><h2>项目探索</h2><p>选择一个项目，查看阶段进展、任务状态和依赖关系。</p></div><span className="project-count">{projects.length} 个项目</span></div>
   <label className="project-search"><span>搜索项目</span><input aria-label="搜索项目" placeholder="输入项目名称或关键词…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   {matches.length?<div className="project-grid">{matches.map(p=>{
    const list=issues.filter(i=>i.projectId===p.id),s=summarize(list),blockedCount=list.filter(i=>blocked.has(i.id)).length;
    return <button key={p.id} className="project-card project-index-card" onClick={()=>choose(p.id)}>
     <div className="project-card-top"><span className="project-card-kicker">PROJECT</span><span className="project-card-arrow">↗</span></div>
     <h3>{p.title}</h3><p className="project-description">{p.description||"暂无项目描述。"}</p>
     <div className="project-card-metrics"><span><b>{s.total}</b> 任务</span><span><b>{s.active}</b> 活跃</span><span><b>{blockedCount}</b> 受阻</span><span><b>{milestones.filter(m=>m.projectId===p.id).length}</b> 里程碑</span></div>
     <div className="project-progress-track"><span className="project-progress-fill" style={{width:(s.ratio||0)*100+"%"}}/></div>
     <small>{s.ratio===null?"尚无任务数据":Math.round(s.ratio*100)+"% 任务已完成"} · 打开项目工作区</small>
    </button>;
   })}</div>:<div className="project-empty" role="status">{projects.length?"没有匹配项目，请调整搜索条件。":"当前团队尚无可展示的项目。"}</div>}
  </section>;
 }
 const list=issues.filter(i=>i.projectId===project.id&&!i.archived),summary=summarize(list);
 const projectMilestones=milestones.filter(m=>m.projectId===project.id),blockedCount=list.filter(i=>blocked.has(i.id)).length;
 const selected=list.filter(i=>{
  const text=[i.identifier,i.title,i.assignee,i.status].join(" ").toLowerCase();
  return (scope!=="blocked"||blocked.has(i.id))&&(scope!=="active"||!["completed","canceled"].includes(i.statusType||""))&&(scope!=="done"||i.statusType==="completed")&&text.includes(tasks.trim().toLowerCase());
 }).sort((a,b)=>sort==="priority"?(a.priority||99)-(b.priority||99):sort==="title"?a.title.localeCompare(b.title,"zh-CN"):(b.updatedAt||"").localeCompare(a.updatedAt||""));
 const groups=new Map<string,Item[]>();for(const m of projectMilestones)groups.set(m.id,[]);
 for(const issue of selected){const id=issue.milestoneId&&groups.has(issue.milestoneId)?issue.milestoneId:"";if(!groups.has(id))groups.set(id,[]);groups.get(id)!.push(issue);}
 return <section className="project-explorer project-workspace" aria-label="项目工作区">
  <div className="project-workspace-heading"><div><button className="project-back-link" onClick={()=>choose("all")}>返回项目索引</button><span className="eyebrow">PROJECT WORKSPACE</span><h2>{project.title}</h2><p className="project-description">{project.description||"暂无项目描述。"}</p></div>
   <div className="project-workspace-actions"><button className="button" onClick={()=>explore("hierarchy",project.id)}>项目任务层级</button><button className="button" onClick={()=>explore("dependency",project.id)}>项目依赖图</button></div>
  </div>
  <div className="project-stat-grid">
   <div className="project-stat"><span>全部任务</span><strong>{summary.total}</strong><small>非归档任务</small></div>
   <div className="project-stat"><span>活跃任务</span><strong>{summary.active}</strong><small>尚未完成或取消</small></div>
   <div className="project-stat project-stat-warning"><span>受阻任务</span><strong>{blockedCount}</strong><small>存在未完成前置项</small></div>
   <div className="project-stat"><span>逾期任务</span><strong>{summary.overdue}</strong><small>按截止日期计算</small></div>
   <div className="project-stat"><span>已完成</span><strong>{summary.completed}</strong><small>不等同工程完成度</small></div>
  </div>
  <div className="project-section"><div className="project-section-heading"><div><h3>任务状态</h3><p>按 Linear 当前状态统计，不代表项目整体完成度。</p></div><span>{summary.total?Math.round((summary.ratio||0)*100)+"% 已完成":"暂无任务"}</span></div>
   <div className="project-status-list">{summary.states.map(([state,count])=><span className="project-status-chip" key={state}><b>{count}</b> {state}</span>)}</div>
   <div className="project-progress-track project-progress-large"><span className="project-progress-fill" style={{width:(summary.ratio||0)*100+"%"}}/></div>
  </div>
  <div className="project-section"><div className="project-section-heading"><div><h3>里程碑进展</h3><p>逐个查看阶段任务数量、完成情况和阻塞情况。</p></div><span>{projectMilestones.length} 个里程碑</span></div>
   {projectMilestones.length?<div className="project-milestone-grid">{projectMilestones.map(m=>{
    const ms=list.filter(i=>i.milestoneId===m.id),s=summarize(ms);
    return <div className="project-milestone-card" key={m.id}><div className="project-milestone-top"><strong>{m.title}</strong><span>{s.completed}/{s.total}</span></div><div className="project-progress-track"><span className="project-progress-fill" style={{width:(s.ratio||0)*100+"%"}}/></div><small>{s.active} 活跃 · {ms.filter(i=>blocked.has(i.id)).length} 受阻 · {s.overdue} 逾期</small></div>;
   })}</div>:<div className="project-empty">该项目尚未设置里程碑。</div>}
  </div>
  <div className="project-section"><div className="project-section-heading"><div><h3>项目任务</h3><p>按里程碑组织任务，选择任务可查看完整详情与审阅证据。</p></div><span>{selected.length} / {list.length} 项</span></div>
   <div className="project-toolbar">
    <label className="project-search project-task-search"><span>搜索任务</span><input aria-label="搜索项目任务" placeholder="任务编号、标题或负责人…" value={tasks} onChange={e=>setTasks(e.target.value)}/></label>
    <label className="project-filter"><span>任务范围</span><select aria-label="任务范围" value={scope} onChange={e=>setScope(e.target.value)}><option value="all">全部任务</option><option value="active">未完成任务</option><option value="blocked">受阻任务</option><option value="done">已完成任务</option></select></label>
    <label className="project-filter"><span>排序方式</span><select aria-label="任务排序" value={sort} onChange={e=>setSort(e.target.value)}><option value="updated">最近更新</option><option value="priority">优先级</option><option value="title">任务名称</option></select></label>
   </div>
   {!selected.length?<div className="project-empty" role="status">{list.length?"当前条件下没有匹配任务。":"该项目尚无任务。"}</div>:
    <div className="project-task-groups">{[...groups].filter(([,rows])=>rows.length).map(([id,rows])=><details className="project-task-group" open key={id}>
     <summary><span>{projectMilestones.find(m=>m.id===id)?.title||"未分配里程碑"}</span><span>{rows.length} 项任务</span></summary>
     <div className="project-task-list">{rows.map(i=><button className="project-task-row" key={i.id} onClick={()=>open(i)}>
      <span className="project-task-main"><span className="project-task-topline"><span className="project-issue-id">{i.identifier||"ISSUE"}</span><span className={"project-status-pill project-status-"+tone(i.statusType)}>{i.status||"未知状态"}</span>{blocked.has(i.id)&&<span className="project-blocked-pill">存在未完成前置项</span>}</span><strong>{i.title}</strong><span className="project-task-meta"><span>{i.assignee||"未分配负责人"}</span><span>{(["紧急","高","中","低"][((i.priority||0)-1)]||"未设置优先级")}</span>{i.dueDate&&<span>截止 {shortDate(i.dueDate)}</span>}</span></span><span className="project-task-open">→</span>
     </button>)}</div>
    </details>)}</div>}
  </div>
  <p className="project-data-note">数据来自最近一次成功的 Linear 团队同步；项目探索不会单独发起第二次同步。</p>
 </section>;
}