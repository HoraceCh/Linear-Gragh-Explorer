export interface Identity {
  workspaceId: string;
  userId: string;
}
export function preferenceKey(identity: Identity, preference: string, teamId?: string) {
  return "lge:" + JSON.stringify([identity.workspaceId, identity.userId, preference, teamId ?? null]);
}
