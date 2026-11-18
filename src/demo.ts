import { normalize, type Item, type Link } from "./model";
export function demoGraph() {
  const items: Item[] = [
    {
      id: "demo-project",
      kind: "project",
      title: "示例 · 清洁机器人概念研究",
      description: "完全合成的数据，用于体验图谱交互；不代表真实团队 任务。",
    },
    { id: "demo-empty", kind: "project", title: "示例 · 空项目" },
  ];
  for (let m = 0; m < 4; m++)
    items.push({
      id: `m${m}`,
      kind: "milestone",
      title: [
        "01 · 场景与约束",
        "02 · 工艺与材料",
        "03 · 方案设计",
        "04 · 综合评估",
      ][m],
      projectId: "demo-project",
    });
  const titles = [
    "明确应用场景",
    "整理组件限制",
    "记录水源条件",
    "对比喷头方案",
    "评估材料兼容性",
    "分析软管影响",
    "比较移动构型",
    "定义模块接口",
    "制定验证计划",
    "汇总风险证据",
    "形成研究结论",
    "独立探索任务",
  ];
  titles.forEach((title, i) =>
    items.push({
      id: `i${i}`,
      kind: "issue",
      teamId: "synthetic-team",
      identifier: `DEMO-${i + 1}`,
      title,
      description:
        "这是一条合成任务。用于验证筛选、依赖方向、跨里程碑关联与任务详情。",
      projectId: "demo-project",
      milestoneId: `m${Math.min(3, Math.floor(i / 3))}`,
      assignee: ["研究员 A", "研究员 B", "研究员 C"][i % 3],
      status: ["进行中", "待开始", "已完成"][i % 3],
      statusType: ["started", "unstarted", "completed"][i % 3],
      priority: (i % 4) + 1,
      parentId: i === 8 ? "i9" : undefined,
    }),
  );
  const links: Link[] = [
    [0, 1],
    [0, 2],
    [1, 4],
    [2, 3],
    [3, 5],
    [4, 6],
    [5, 6],
    [6, 7],
    [7, 9],
    [9, 10],
  ].map(([s, t]) => ({
    id: `d${s}-${t}`,
    source: `i${s}`,
    target: `i${t}`,
    kind: "blocks",
  }));
  links.push({ id: "related", source: "i3", target: "i4", kind: "related" });
  return {
    ...normalize(items, links, [], "synthetic-team"),
    source: "synthetic" as const,
  };
}

/** Reproducible synthetic visual benchmarks; never presented as synchronized data. */
export function scaleGraph(count: 20 | 50 | 100) {
  const base = demoGraph();
  const items = base.items.filter((n) => n.kind !== "issue");
  for (let i = 0; i < count; i++) items.push({
    id: `scale-${i}`, kind: "issue", teamId: "synthetic-team",
    identifier: `SCALE-${i + 1}`, title: `合成任务 ${i + 1} · 验证跨阶段协作与依赖`,
    projectId: "demo-project", milestoneId: `m${Math.floor(i * 4 / count)}`,
    assignee: `研究员 ${["A", "B", "C"][i % 3]}`, status: "待开始", statusType: "unstarted",
  });
  const total = count === 20 ? 100 : count === 50 ? 200 : 500;
  const links: Link[] = [];
  const add = (s: number, t: number, kind: "blocks" | "related") => links.push({
    id: `${kind}-${s}-${t}`, source: `scale-${s}`, target: `scale-${t}`, kind,
  });
  const dependencyTarget = count === 100 ? 300 : count - 1;
  outer: for (let distance = 1; distance < count; distance++) {
    for (let s = 0; s + distance < count; s++) {
      if (links.length >= dependencyTarget) break outer;
      add(s, s + distance, "blocks");
    }
  }
  outer: for (let distance = 2; distance < count; distance++) {
    for (let s = 0; s + distance < count; s++) {
      if (links.length >= total) break outer;
      add(s, s + distance, "related");
    }
  }
  return { ...normalize(items, links, [], "synthetic-team"), source: "synthetic" as const };
}
