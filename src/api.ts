import type { TeamContext } from "./team/types";
import { LinearAccessError } from "./team/access-error";
import { accessToken } from "./auth";
import { normalize, type Graph, type Item, type Link } from "./model";
export type Transport = (
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<any>;
export { LinearAccessError } from "./team/access-error";

export const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    if (signal?.aborted) {
      rej(new DOMException("Canceled", "AbortError"));
      return;
    }
    const cancel = () => {
      clearTimeout(id);
      rej(new DOMException("Canceled", "AbortError"));
    };
    const id = setTimeout(() => {
      signal?.removeEventListener("abort", cancel);
      res();
    }, ms);
    signal?.addEventListener(
      "abort",
      cancel,
      { once: true },
    );
  });
export const directTransport: Transport = async (query, variables, signal) => {
  if (!/^\s*query\b/.test(query))
    throw new Error("只读数据层拒绝非 query 操作。");
  for (let attempt = 0; attempt < 4; attempt++) {
    signal?.throwIfAborted();
    const token = await accessToken();
    const r = await fetch("https://api.linear.app/graphql", {
      method: "POST", cache: "no-store", credentials: "omit",
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
      throw new LinearAccessError("Linear 授权已失效或没有访问权限，请重新连接。");
    const body = await r.json().catch(() => ({}));
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
    if (body.errors?.some((e: any) => ["AUTHENTICATION_ERROR", "FORBIDDEN", "UNAUTHENTICATED"].includes(e.extensions?.code)))
      throw new LinearAccessError("Linear 已拒绝访问，请重新连接。");
    if (!r.ok || body.errors?.length || !body.data)
      throw new Error("Linear 查询失败；本次数据未完整返回，未替换上次快照。");
    return body.data;
  }
  throw new Error("请求未完成");
};
export async function paginate<T>(
  load: (cursor: string | null) => Promise<{
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
// Fixed application-owned selections keep every nested read scoped on the provider,
// including when an issue moves after the initial team snapshot.
export async function readScopedIssue(
  operation: string,
  selection: string,
  team: TeamContext,
  issueId: string,
  cursor: string | null,
  transport: Transport,
  signal?: AbortSignal,
  threadId?: string,
) {
  signal?.throwIfAborted();
  const threadVariable = threadId === undefined ? "" : ",$thread:ID!";
  const query = `query ${operation}($id:ID!,$team:ID!,$cursor:String${threadVariable}){
    issues(first:1,includeArchived:true,filter:{id:{eq:$id},team:{id:{eq:$team}}}){
      nodes{id team{id} ${selection}}
    }
  }`;
  const data = await transport(query, {
    id: issueId, team: team.id, cursor,
    ...(threadId === undefined ? {} : { thread: threadId }),
  }, signal);
  signal?.throwIfAborted();
  const node = data?.issues?.nodes?.[0];
  if (node?.id !== issueId || node?.team?.id !== team.id)
    throw new LinearAccessError("任务不可访问或 Team 已改变，请重新同步。");
  return node;
}
export async function syncGraph(
  team: TeamContext,
  transport: Transport = directTransport,
  signal?: AbortSignal,
  onProgress: (s: string) => void = () => {},
): Promise<Graph> {
  const request = (q: string, v: Record<string, unknown> = {}) =>
    transport(q, v, signal);
  onProgress("验证所选团队访问权限…");
  const permission = await request(
    "query TeamPermission($id:String!){team(id:$id){id key name}}",
    { id: team.id },
  );
  if (permission.team?.id !== team.id || permission.team?.key !== team.key)
    throw new LinearAccessError("当前身份无权访问所选团队。");
  const teamId = team.id;
  onProgress("读取 Projects 与 Issues…");
  const projects: any[] = await paginate(
    async (cursor) =>
      (
        await request(
          "query SelectedTeamProjects($team:String!,$cursor:String){team(id:$team){projects(first:50,after:$cursor,includeArchived:true,includeSubTeams:false){nodes{id name url description archivedAt}pageInfo{hasNextPage endCursor}}}}",
          { team: teamId, cursor },
        )
      ).team.projects,
  );
  const issues: any[] = await paginate(
    async (cursor) =>
      (
        await request(
          "query SelectedTeamIssues($team:ID!,$cursor:String){issues(first:50,after:$cursor,includeArchived:true,filter:{team:{id:{eq:$team}}}){nodes{id identifier title description url archivedAt priority team{id} state{id name type} assignee{id name} project{id} projectMilestone{id} parent{id} cycle{number} updatedAt dueDate}pageInfo{hasNextPage endCursor}}}",
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
      stateId: i.state?.id,
      assigneeId: i.assignee?.id,
      updatedAt: i.updatedAt,
      dueDate: i.dueDate,
      cycleNumber: i.cycle?.number,
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
{
          const data = await request(
            "query SelectedTeamMilestones($team:String!,$id:ID!,$cursor:String){team(id:$team){id projects(first:1,includeArchived:true,includeSubTeams:false,filter:{id:{eq:$id}}){nodes{id projectMilestones(first:50,after:$cursor,includeArchived:true){nodes{id name description}pageInfo{hasNextPage endCursor}}}}}}",
            { team: teamId, id: p.id, cursor },
          );
          const project = data.team?.projects?.nodes?.[0];
          if (data.team?.id !== teamId || project?.id !== p.id)
            throw new LinearAccessError("项目已移出团队或不可访问，请重新同步。");
          return project.projectMilestones;
        },
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
  // Only fetch relations from an already validated SelectedTeam issue. Foreign endpoints: ID only, never dereference.
  await boundedMap(
    issues,
    4,
    async (i: any) => {
      onProgress(`读取任务关系 · ${issues.indexOf(i) + 1}/${issues.length}`);
      for (const field of ["relations", "inverseRelations"]) {
        const rs: any[] = await paginate(
          async (cursor) =>
            (
              await readScopedIssue("SelectedTeamRelations",
                `${field}(first:100,after:$cursor,includeArchived:true){nodes{id type issue{id} relatedIssue{id}}pageInfo{hasNextPage endCursor}}`,
                team, i.id, cursor, transport, signal,
              )
            )[field],
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
    },
    signal,
  );
  const graph = normalize(items, relations, [], teamId);
  const metadata = await Promise.all(
    ["members", "states", "labels"].map((field) =>
      paginate<any>(
        async (cursor) =>
          (
            await request(
              `query TeamMetadata($id:String!,$cursor:String){team(id:$id){${field}(first:100,after:$cursor){nodes{id name ${field === "states" ? "type" : ""}}pageInfo{hasNextPage endCursor}}}}`,
              { id: team.id, cursor },
            )
          ).team[field],
      ),
    ),
  );
  graph.teamId = team.id;
  graph.members = metadata[0];
  graph.states = metadata[1];
  graph.labels = metadata[2];
  const itemsById = new Map(graph.items.map(item => [item.id, item]));
  await boundedMap(
    issues,
    4,
    async (i: any) => {
      const labels = await paginate<any>(
        async (cursor) =>
          (
            await readScopedIssue("IssueLabels",
              "labels(first:100,after:$cursor){nodes{id}pageInfo{hasNextPage endCursor}}",
              team, i.id, cursor, transport, signal,
            )
          ).labels,
      );
      const item = itemsById.get(i.id);
      if (item) item.labels = labels.map((l) => l.id);
    },
    signal,
  );
  return graph;
}

export async function boundedMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const result: R[] = new Array(items.length);
  let next = 0;
  let failure: unknown;
  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), items.length) },
      async () => {
        while (next < items.length && !failure) {
          signal?.throwIfAborted();
          const index = next++;
          try {
            result[index] = await fn(items[index]);
          } catch (e) {
            failure = e;
          }
        }
      },
    ),
  );
  if (failure) throw failure;
  signal?.throwIfAborted();
  return result;
}
export async function discoverTeams(
  transport: Transport = directTransport,
  signal?: AbortSignal,
): Promise<TeamContext[]> {
  return paginate<TeamContext>(
    async (cursor) =>
      (
        await transport(
          "query AccessibleTeams($cursor:String){teams(first:50,after:$cursor){nodes{id key name}pageInfo{hasNextPage endCursor}}}",
          { cursor },
          signal,
        )
      ).teams,
  );
}


export async function discoverIdentity(transport: Transport = directTransport, signal?: AbortSignal) {
  const data = await transport("query SessionIdentity { viewer { id organization { id } } }", {}, signal);
  signal?.throwIfAborted();
  const userId = data?.viewer?.id, workspaceId = data?.viewer?.organization?.id;
  if (typeof userId !== "string" || !userId || typeof workspaceId !== "string" || !workspaceId)
    throw new LinearAccessError("无法确认当前 Linear 账号与工作区，请重新连接。");
  return { userId, workspaceId };
}
