import { expect, test, vi } from "vitest";
import { discoverIdentity } from "../src/api";
import { callbackAllowed } from "../src/auth";
import { defaultProfile, importLegacyProfile, loadProfile, saveProfile } from "../src/profiles/model";
import { preferenceKey } from "../src/team/identity";

const a = { workspaceId: "space-a", userId: "user-a" };
const b = { ...a, userId: "user-b" };
const other = { ...a, workspaceId: "space-b" };

test("profiles and restored team selections have separate user and workspace scopes", () => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k), setItem: (k: string, v: string) => storage.set(k,v), removeItem: (k:string) => storage.delete(k) });
  try {
    const p = {...defaultProfile("team","T"), unmappedWorkstream:"chosen"};
    localStorage.setItem("lge-profile:team", JSON.stringify(p));
    expect(loadProfile(b,"team","T")).not.toEqual(p);
    expect(importLegacyProfile(a,"team")).toEqual(p);
    expect(localStorage.getItem("lge-profile:team")).toBeUndefined();
    for (const identity of [b, other]) {
      expect(loadProfile(identity,"team","T")).not.toEqual(p);
      expect(preferenceKey(identity,"selected-team")).not.toBe(preferenceKey(a,"selected-team"));
      saveProfile(identity,defaultProfile("team","T"));
    }
    expect(loadProfile(a,"team","T")).toEqual(p);
  } finally { vi.unstubAllGlobals(); }
});

test("provider identity and workspace are both required before using preferences", async () => {
  for (const viewer of [{id:"x"}, {organization:{id:"y"}}, null])
    await expect(discoverIdentity(async () => ({viewer}))).rejects.toThrow();
  expect(await discoverIdentity(async () => ({viewer:{id:"u",organization:{id:"o"}}}))).toEqual({workspaceId:"o",userId:"u"});
});
test("hosted OAuth only accepts an exact registered HTTPS entry", () => {
  const stable = "https://preview.example.test/";
  expect(callbackAllowed(stable,stable,true)).toBe(true);
  for (const current of ["https://random.example.test/",stable+"other","http://preview.example.test/",stable+"?x=1"])
    expect(callbackAllowed(current,stable,true)).toBe(false);
  expect(callbackAllowed(stable,undefined,true)).toBe(false);
});

test("Pages requires the exact registered project path including the slash", () => {
  const entry = "https://demo.github.io/example/";
  expect(callbackAllowed(entry, undefined, false)).toBe(false);
  expect(callbackAllowed(entry, entry.slice(0,-1), false)).toBe(false);
  expect(callbackAllowed(entry, entry, false)).toBe(true);
});

import { invalidReviewReferences } from "../src/profiles/model";
import { defaultMarkers } from "../src/profiles/model";
test("a removed reviewer or state invalidates an enabled imported policy", () => {
  const policy = {enabled:true,requiredApprovals:1,eligibleReviewerIds:["r"],inReviewStateIds:["s"],excludeAssignee:true,markers:defaultMarkers};
  const directory = {members:[{id:"r"}],states:[{id:"s"}]};
  expect(invalidReviewReferences(policy,directory)).toBeUndefined();
  expect(invalidReviewReferences(policy,{...directory,members:[]})).toBeTruthy();
  expect(invalidReviewReferences(policy,{...directory,states:[]})).toBeTruthy();
});
