export interface RoleDefinition {
  id: string;
  name: string;
}
export interface ReviewPolicy {
  enabled: boolean;
  requiredApprovals: number;
  eligibleReviewerIds: string[];
  excludeAssignee: boolean;
  inReviewStateIds: string[];
  markers: { approve: string; requestChanges: string; hold: string };
}
export interface TeamProfile {
  version: 1;
  teamId: string;
  teamKey: string;
  roles: RoleDefinition[];
  memberRoleMap: Record<string, string[]>;
  workstreamLabelMap: Record<string, string>;
  unmappedWorkstream: string;
  reviewPolicy?: ReviewPolicy;
}
export const defaultMarkers = {
  approve: "[REVIEW: APPROVE]",
  requestChanges: "[REVIEW: REQUEST_CHANGES]",
  hold: "[REVIEW: HOLD]",
};
export function defaultProfile(teamId: string, teamKey: string): TeamProfile {
  return {
    version: 1,
    teamId,
    teamKey,
    roles: [],
    memberRoleMap: {},
    workstreamLabelMap: {},
    unmappedWorkstream: "未映射",
  };
}
export function validateProfile(value: unknown, teamId: string): TeamProfile {
  const p = value as TeamProfile;
  if (
    !p ||
    p.version !== 1 ||
    p.teamId !== teamId ||
    typeof p.teamKey !== "string" ||
    !Array.isArray(p.roles) ||
    !p.memberRoleMap ||
    !p.workstreamLabelMap ||
    typeof p.unmappedWorkstream !== "string"
  )
    throw new Error("配置格式或团队不匹配。");
  if (
    p.roles.some(
      (r) => !r || typeof r.id !== "string" || typeof r.name !== "string",
    ) ||
    new Set(p.roles.map((r) => r.id)).size !== p.roles.length
  )
    throw new Error("角色定义无效。");
  for (const [id, roles] of Object.entries(p.memberRoleMap)) {
    if (
      !id ||
      !Array.isArray(roles) ||
      roles.some((r) => !p.roles.some((x) => x.id === r))
    )
      throw new Error("角色映射无效。");
  }
  if (Object.values(p.workstreamLabelMap).some((v) => typeof v !== "string"))
    throw new Error("工作流映射无效。");
  const r = p.reviewPolicy;
  if (
    r &&
    (typeof r.enabled !== "boolean" ||
      !Number.isInteger(r.requiredApprovals) ||
      r.requiredApprovals < 1 ||
      !Array.isArray(r.eligibleReviewerIds) ||
      r.eligibleReviewerIds.some((x) => typeof x !== "string") ||
      !Array.isArray(r.inReviewStateIds) ||
      r.inReviewStateIds.some((x) => typeof x !== "string") ||
      typeof r.excludeAssignee !== "boolean" ||
      !r.markers ||
      Object.values(r.markers).length !== 3 ||
      Object.values(r.markers).some(
        (x) => typeof x !== "string" || !/^\[REVIEW: [A-Z_]+\]$/i.test(x),
      ) ||
      new Set(Object.values(r.markers).map((x) => x.toUpperCase())).size !== 3)
  )
    throw new Error("审阅策略无效。");
  // Allowlist reconstruction discards task snapshots, token fields and unknown payloads.
  return {
    version: 1,
    teamId: p.teamId,
    teamKey: p.teamKey,
    roles: p.roles.map((r) => ({ id: r.id, name: r.name })),
    memberRoleMap: Object.fromEntries(
      Object.entries(p.memberRoleMap).map(([k, v]) => [k, [...v]]),
    ),
    workstreamLabelMap: { ...p.workstreamLabelMap },
    unmappedWorkstream: p.unmappedWorkstream,
    ...(r
      ? {
          reviewPolicy: {
            enabled: r.enabled,
            requiredApprovals: r.requiredApprovals,
            eligibleReviewerIds: [...new Set(r.eligibleReviewerIds)],
            excludeAssignee: r.excludeAssignee,
            inReviewStateIds: [...new Set(r.inReviewStateIds)],
            markers: {
              approve: r.markers.approve,
              requestChanges: r.markers.requestChanges,
              hold: r.markers.hold,
            },
          },
        }
      : {}),
  };
}
export function loadProfile(id: string, key: string) {
  try {
    return validateProfile(
      JSON.parse(localStorage.getItem(`lge-profile:${id}`) || "null"),
      id,
    );
  } catch {
    return defaultProfile(id, key);
  }
}
export function saveProfile(p: TeamProfile) {
  localStorage.setItem(
    `lge-profile:${p.teamId}`,
    JSON.stringify(validateProfile(p, p.teamId)),
  );
}
