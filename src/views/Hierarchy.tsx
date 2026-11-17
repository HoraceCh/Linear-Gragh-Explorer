import { useState } from "react";
import type { Graph, Item } from "../model";
export function Hierarchy({
  graph,
  items,
  onSelect,
}: {
  graph: Graph;
  items: Item[];
  onSelect: (n: Item) => void;
}) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const issues = items.filter((n) => n.kind === "issue");
  const toggle = (id: string) =>
    setClosed((prev) => {
      const x = new Set(prev);
      x.has(id) ? x.delete(id) : x.add(id);
      return x;
    });
  const issue = (n: Item, seen: Set<string>): any => {
    if (seen.has(n.id)) return <p key={n.id}>父子循环：{n.identifier}</p>;
    const children = issues.filter((i) => i.parentId === n.id);
    return (
      <div key={n.id} className="tree-issue">
        <div>
          <button
            onClick={() => toggle(n.id)}
            aria-label={`展开或折叠 ${n.identifier}`}
          >
            {children.length ? (closed.has(n.id) ? "▸" : "▾") : "·"}
          </button>
          <button className="tree-title" onClick={() => onSelect(n)}>
            <small>{n.identifier}</small> {n.title} <span>{n.status}</span>
          </button>
        </div>
        {!closed.has(n.id) &&
          children.map((c) => issue(c, new Set([...seen, n.id])))}
      </div>
    );
  };
  const projects = [
    ...graph.items.filter((n) => n.kind === "project"),
    { id: "unassigned", title: "未归属项目", kind: "project" as const },
  ];
  return (
    <section className="hierarchy">
      <div className="graph-actions">
        <span>项目 / 里程碑 / 父子层级；不展示依赖边</span>
        <button
          className="button small"
          onClick={() => setClosed(new Set(graph.items.map((n) => n.id)))}
        >
          全部折叠
        </button>
        <button className="button small" onClick={() => setClosed(new Set())}>
          全部展开
        </button>
      </div>
      {projects.map((p) => {
        const list = issues.filter(
          (n) => (n.projectId || "unassigned") === p.id,
        );
        if (!list.length && p.id === "unassigned") return null;
        const ms = [
          ...graph.items.filter(
            (n) => n.kind === "milestone" && n.projectId === p.id,
          ),
          { id: "none", title: "无里程碑" },
        ];
        return (
          <div className="tree-project" key={p.id}>
            <button onClick={() => toggle(p.id)}>
              <b>
                {closed.has(p.id) ? "▸" : "▾"} {p.title}
              </b>{" "}
              · {list.length} 项
            </button>
            {!closed.has(p.id) &&
              ms.map((m) => {
                const sub = list.filter(
                  (n) => (n.milestoneId || "none") === m.id,
                );
                const roots = sub.filter(
                  (n) =>
                    !issues.some(
                      (i) => i.id === n.parentId && i.projectId === n.projectId,
                    ),
                );
                if (!sub.length && m.id === "none") return null;
                return (
                  <div className="tree-milestone" key={m.id}>
                    <button onClick={() => toggle(m.id)}>
                      {closed.has(m.id) ? "▸" : "▾"} {m.title} · {sub.length}
                    </button>
                    {!closed.has(m.id) && roots.map((n) => issue(n, new Set()))}
                    {!closed.has(m.id) && !roots.length && sub.length > 0 && (
                      <p>
                        子任务在所属父任务下显示；跨里程碑归属保留在详情中。
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        );
      })}
    </section>
  );
}
