import { useState } from "react";
import type { Graph } from "../model";
import { defaultMarkers, defaultProfile, invalidReviewReferences, validateProfile, type TeamProfile } from "../profiles/model";
type Policy=NonNullable<TeamProfile["reviewPolicy"]>;
const toggle=(values:string[],id:string)=>values.includes(id)?values.filter(v=>v!==id):[...values,id];

export function ProfileEditor({value,graph,onSave,onLegacy,onClose}:{value:TeamProfile;graph:Graph;onLegacy?:()=>TeamProfile;onSave:(p:TeamProfile)=>void;onClose:()=>void}){
 const [p,setP]=useState(()=>structuredClone(value)),[error,setError]=useState("");
 const inferred=(graph.states||[]).filter(s=>/^(?:in\s+)?review$/i.test(s.name.trim())).map(s=>s.id);
 const policy:Policy=p.reviewPolicy ?? {enabled:false,requiredApprovals:2,eligibleReviewerIds:[],excludeAssignee:true,inReviewStateIds:inferred,markers:defaultMarkers};
 const update=(patch:Partial<Policy>)=>setP({...p,reviewPolicy:{...policy,...patch}});
 const invalid = invalidReviewReferences(policy,graph);
 const save=()=>{try{if(invalid) throw new Error(invalid);onSave(validateProfile({...p,reviewPolicy:policy},p.teamId));onClose();}catch(e){setError((e as Error).message);}};
 const exportProfile=()=>{try{const safe=validateProfile({...p,reviewPolicy:policy},p.teamId);const url=URL.createObjectURL(new Blob([JSON.stringify(safe,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="linear-graph-explorer-profile.json";a.click();URL.revokeObjectURL(url);}catch(e){setError((e as Error).message);}};
 return <div className="modal-backdrop"><section className="modal profile-modal" role="dialog" aria-modal="true" aria-label="视图与审阅设置" onKeyDown={e=>{if(e.key==="Escape")onClose();}}>
  <div className="section-heading"><div><span className="eyebrow">PERSONAL WORKSPACE SETTINGS</span><h2>视图与审阅设置 · {p.teamKey}</h2></div><button className="button small" onClick={onClose}>关闭</button></div>
  <p className="profile-intro">这里配置的是当前账号在本浏览器中的显示偏好和审阅规则，不会修改 Linear 团队权限，也不会自动同步给其他成员。需要共享规则时，可导出配置并通过团队私有渠道分享，再由成员导入。</p>
  {onLegacy&&<details className="profile-panel"><summary>迁移此设备的旧版配置</summary><p>旧版本没有记录配置所有者。只有确认这是你在此设备创建的配置时才迁移。</p><button className="button" onClick={()=>{try{setP(onLegacy());setError("");}catch(e){setError((e as Error).message);}}}>确认归属并迁移</button></details>}
  {invalid&&<div className="notice error" role="alert">{invalid} <button className="button" onClick={()=>update({
    eligibleReviewerIds:policy.eligibleReviewerIds.filter(id=>graph.members?.some(m=>m.id===id)),
    inReviewStateIds:policy.inReviewStateIds.filter(id=>graph.states?.some(s=>s.id===id))
  })}>移除失效选择</button></div>}
  {error&&<div className="notice error" role="alert">{error}</div>}
  <section className="profile-panel">
   <div className="profile-panel-heading"><div><h3>审阅规则</h3><p>定义应用如何解释 Linear 中的正式审阅评论。</p></div><span className={policy.enabled?"profile-state profile-state-on":"profile-state"}>{policy.enabled?"已启用":"未启用"}</span></div>
   <label className="profile-enable-row"><input type="checkbox" checked={policy.enabled} onChange={e=>update({enabled:e.target.checked})}/><span><strong>启用评论审阅分析</strong><small>只读取评论和状态历史，不会替你批准任务或修改 Linear 状态。</small></span></label>
   <div className="profile-field-grid"><label className="profile-field"><span>需要的批准人数</span><input type="number" min={1} max={20} value={policy.requiredApprovals} onChange={e=>update({requiredApprovals:Math.max(1,Math.min(20,Number(e.target.value)||1))})}/></label>
    <label className="profile-enable-row"><input type="checkbox" checked={policy.excludeAssignee} onChange={e=>update({excludeAssignee:e.target.checked})}/><span><strong>排除任务负责人</strong><small>DRI 的自我确认不计入专业审阅批准人数。</small></span></label></div>
   <fieldset className="profile-choice-fieldset"><legend>有资格的审阅人</legend><p>只有勾选的 Linear 团队成员，其本轮正式评论才会计入审阅结果。</p>
    {graph.members?.length?<div className="profile-choice-grid">{graph.members.map(m=><label className="profile-choice" key={m.id}><input type="checkbox" checked={policy.eligibleReviewerIds.includes(m.id)} onChange={()=>update({eligibleReviewerIds:toggle(policy.eligibleReviewerIds,m.id)})}/><span>{m.name}</span></label>)}</div>:<div className="profile-empty">同步团队后，这里会显示可选成员。</div>}
    <small className="profile-selection-count">已选择 {policy.eligibleReviewerIds.length} 位审阅人</small>
   </fieldset>
   <fieldset className="profile-choice-fieldset"><legend>哪些 Linear 状态代表 In Review</legend><p>自动建议名称为 In Review 或 Review 的状态；也可选择团队的自定义审阅状态。</p>
    {graph.states?.length?<div className="profile-choice-grid">{graph.states.map(st=><label className="profile-choice" key={st.id}><input type="checkbox" checked={policy.inReviewStateIds.includes(st.id)} onChange={()=>update({inReviewStateIds:toggle(policy.inReviewStateIds,st.id)})}/><span>{st.name}</span><small>{st.type}</small></label>)}</div>:<div className="profile-empty">同步团队后，这里会显示真实状态 ID。</div>}
    <small className="profile-selection-count">已选择 {policy.inReviewStateIds.length} 个状态</small>
   </fieldset>
   <details className="profile-advanced"><summary>高级：自定义 REVIEW 标记</summary><p>普通英文命令始终可用；以下标记用于显式 REVIEW 命令。</p>
    {(["approve","requestChanges","hold"] as const).map(k=><label className="profile-field" key={k}><span>{k==="approve"?"批准标记":k==="requestChanges"?"要求修改标记":"暂缓标记"}</span><input value={policy.markers[k]} onChange={e=>update({markers:{...policy.markers,[k]:e.target.value}})}/></label>)}
    <p>固定命令还包括 Unable to assess（无法判断），该结果不会被计为批准。</p>
   </details>
  </section>
  <details className="profile-panel"><summary>视图个性化 · 角色与 Workstream</summary><p>这些设置只用于当前账号的任务筛选与显示，不会更改 Linear 的真实成员角色或标签。</p>
   <div className="profile-panel-heading"><h3>自定义角色</h3><button className="button small" onClick={()=>setP({...p,roles:[...p.roles,{id:crypto.randomUUID(),name:"新角色"}]})}>添加角色</button></div>
   {p.roles.length?<>{p.roles.map(role=><div className="profile-role-row" key={role.id}><input aria-label="角色名称" value={role.name} onChange={e=>setP({...p,roles:p.roles.map(x=>x.id===role.id?{...x,name:e.target.value}:x)})}/><button className="button small" onClick={()=>setP({...p,roles:p.roles.filter(x=>x.id!==role.id),memberRoleMap:Object.fromEntries(Object.entries(p.memberRoleMap).map(([id,roles])=>[id,roles.filter(x=>x!==role.id)]))})}>移除</button></div>)}
    <h4>成员角色映射</h4>{graph.members?.map(m=><div className="profile-role-map" key={m.id}><strong>{m.name}</strong><div className="profile-inline-choices">{p.roles.map(role=><label key={role.id}><input type="checkbox" checked={(p.memberRoleMap[m.id]||[]).includes(role.id)} onChange={()=>setP({...p,memberRoleMap:{...p.memberRoleMap,[m.id]:toggle(p.memberRoleMap[m.id]||[],role.id)}})}/>{role.name}</label>)}</div></div>)}</>:<div className="profile-empty">尚未创建角色。角色映射是可选功能；不创建角色不会影响项目、图谱或审阅功能。</div>}
   <h3>Workstream 映射</h3>{graph.labels?.length?graph.labels.map(l=><label className="profile-role-row" key={l.id}><span>{l.name}</span><input aria-label={l.name+" 工作流"} placeholder="未映射" value={p.workstreamLabelMap[l.id]||""} onChange={e=>setP({...p,workstreamLabelMap:{...p.workstreamLabelMap,[l.id]:e.target.value}})}/></label>):<div className="profile-empty">当前团队没有可映射的 Label。</div>}
   <label className="profile-field"><span>未映射任务的显示名称</span><input value={p.unmappedWorkstream} onChange={e=>setP({...p,unmappedWorkstream:e.target.value})}/></label>
  </details>
  <details className="profile-panel"><summary>配置导入、导出与恢复</summary><p>导出文件包含 Team、成员和标签 ID，不包含访问令牌或任务快照。只通过团队私有渠道分享。</p>
   <div className="settings-buttons"><button className="button" onClick={exportProfile}>导出配置 JSON</button><label className="button">导入配置 JSON<input type="file" accept=".json,application/json" hidden onChange={async e=>{try{const f=e.target.files?.[0];if(!f)return;if(f.size>1000000)throw new Error("配置文件过大。");setP(validateProfile(JSON.parse(await f.text()),p.teamId));setError("");e.target.value="";}catch(err){setError((err as Error).message);}}}/></label><button className="button" onClick={()=>setP(defaultProfile(p.teamId,p.teamKey))}>恢复默认</button></div>
  </details>
  <div className="profile-footer"><span>配置范围：当前账号 · 当前浏览器 · 当前 Team</span><div className="settings-buttons"><button className="button" onClick={onClose}>取消</button><button className="button primary" onClick={save}>保存设置</button></div></div>
 </section></div>;
}