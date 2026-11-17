import { accessToken } from "./auth";
import { TEAM_KEY, normalize, type Graph, type Item, type Link } from "./model";
export type Transport = (
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<any>;
const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const id = setTimeout(res, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        rej(new DOMException("Canceled", "AbortError"));
      },
      { once: true },
    );
  });
export const directTransport: Transport = async (query, variables, signal) => {
  if (!/^\s*query\b/.test(query))
    throw new Error("只读数据层拒绝非 query 操作。");
  for (let attempt = 0; attempt < 4; attempt++) {
    const token = await accessToken();
    const r = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
    });
    if (r.status === 401 || r.status === 403)
      throw new Error("Linear 授权已失效或没有访问权限，请重新连接。");
    const body = await r.json();
    if (
      r.status === 429 ||
      body.errors?.some((e: any) => e.extensions?.code === "RATELIMITED")
    ) {
      if (attempt === 3) throw new Error("Linear 限流，请稍后刷新。");
      const seconds = Number(r.headers.get("Retry-After"));
      await wait(
        Math.min(60000, seconds > 0 ? seconds * 1000 : 1000 * 2 ** attempt),
        signal,
      );
      continue;
    }
    if (!r.ok || body.errors?.length)
      throw new Error("Linear 查询失败；本次数据未完整返回，未替换上次快照。");
    return body.data;
  }
  throw new Error("请求未完成");
};
export async function paginate<T>(
  load: (
    cursor: string | null,
  ) => Promise<{
    nodes: T[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  }>,
) {
  const result: T[] = [];
  let cursor: string | null = null;
  const cursors = new Set<string>();
  for (let page = 0; page < 10000; page++) {
    const c = await load(cursor);
    result.push(...c.nodes);
    if (!c.pageInfo.hasNextPage) return result;
    if (!c.pageInfo.endCursor || cursors.has(c.pageInfo.endCursor))
      throw new Error("分页游标异常。");
    cursor = c.pageInfo.endCursor;
    cursors.add(cursor);
  }
  throw new Error("数据超过分页安全上限。");
}
export async function syncGraph(
  transport: Transport = directTransport,
  signal?: AbortSignal,
  onProgress: (s: string) => void = () => {},
): Promise<Graph> {
  const request = (q: string, v: Record<string, unknown> = {}) =>
    transport(q, v, signal);
  onProgress("验证 PVCR Team 访问权限…");
  const permission = await request(
    "query PVCRPermission($key:String!){teams(first:2,filter:{key:{eq:$key}}){nodes{id key}}}",
    { key: TEAM_KEY },
  );
  const candidates = permission.teams?.nodes;
  if (!Array.isArray(candidates) || candidates.length !== 1 || candidates[0].key !== TEAM_KEY || !candidates[0].id)
    throw new Error("当前 Linear 身份无权访问 PVCR，或团队标识存在歧义。");
  const teamId: string = candidates[0].id;
  onProgress("读取 Projects 与 Issues…");
  const projects: any[] = await paginate(
    async (cursor) =>
      (
        await request(
          "query PVCRProjects($team:String!,$cursor:String){team(id:$team){projects(first:50,after:$cursor,includeArchived:true,includeSubTeams:false){nodes{id name url description archivedAt}pageInfo{hasNextPage endCursor}}}}",
          { team: teamId, cursor },
        )
      ).team.projects,
  );
  const issues: any[] = await paginate(
    async (cursor) =>
      (
        await request(
          "query PVCRIssues($team:ID!,$cursor:String){issues(first:50,after:$cursor,includeArchived:true,filter:{team:{id:{eq:$team}}}){nodes{id identifier title description url archivedAt priority team{id} state{name type} assignee{name} project{id} projectMilestone{id} parent{id}}pageInfo{hasNextPage endCursor}}}",
          { team: teamId, cursor },
        )
      ).issues,
  );
  const items: Item[] = projects.map((p) => ({
    id: p.id,
    kind: "project",
    title: p.name,
    description: p.description,
    url: p.url,
    archived: !!p.archivedAt,
  }));
  for (const i of issues) {
    if (i.team.id !== teamId) throw new Error("Team 范围校验失败。");
    items.push({
      id: i.id,
      kind: "issue",
      teamId: i.team.id,
      title: i.title,
      identifier: i.identifier,
      description: i.description,
      url: i.url,
      archived: !!i.archivedAt,
      priority: i.priority,
      status: i.state?.name,
      statusType: i.state?.type,
      assignee: i.assignee?.name,
      projectId: i.project?.id,
      milestoneId: i.projectMilestone?.id,
      parentId: i.parent?.id,
    });
  }
  for (const p of projects) {
    onProgress(
      `读取 Milestones · ${projects.indexOf(p) + 1}/${projects.length}`,
    );
    const ms: any[] = await paginate(
      async (cursor) =>
        (
          await request(
            "query PVCRMilestones($id:String!,$cursor:String){project(id:$id){projectMilestones(first:50,after:$cursor,includeArchived:true){nodes{id name description}pageInfo{hasNextPage endCursor}}}}",
            { id: p.id, cursor },
          )
        ).project.projectMilestones,
    );
    for (const m of ms)
      items.push({
        id: m.id,
        kind: "milestone",
        title: m.name,
        description: m.description,
        projectId: p.id,
      });
  }
  const relations: Link[] = [];
  // Only fetch relations from an already validated PVCR issue. Foreign endpoints: ID only, never dereference.
  for (const i of issues) {
    onProgress(`读取任务关系 · ${issues.indexOf(i) + 1}/${issues.length}`);
    for (const field of ["relations", "inverseRelations"]) {
      const rs: any[] = await paginate(
        async (cursor) =>
          (
            await request(
              `query PVCRRelations($id:String!,$cursor:String){issue(id:$id){${field}(first:100,after:$cursor,includeArchived:true){nodes{id type issue{id} relatedIssue{id}}pageInfo{hasNextPage endCursor}}}}`,
              { id: i.id, cursor },
            )
          ).issue[field],
      );
      for (const r of rs) {
        if (r.type === "blocks" || r.type === "related")
          relations.push({
            id: r.id,
            source: r.issue.id,
            target: r.relatedIssue.id,
            kind: r.type === "blocks" ? "blocks" : "related",
          });
      }
    }
  }
  return normalize(items, relations, [], teamId);
}
