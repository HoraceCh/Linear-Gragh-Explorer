import { describe, it, expect } from "vitest";
import {
  parseMarker,
  calculateReview,
  roundBoundary,
  type ReviewComment,
} from "../src/review/engine";
import { defaultMarkers, type ReviewPolicy } from "../src/profiles/model";
const policy: ReviewPolicy = {
  enabled: true,
  requiredApprovals: 2,
  eligibleReviewerIds: ["a", "b", "owner"],
  excludeAssignee: true,
  inReviewStateIds: ["review"],
  markers: defaultMarkers,
};
const boundary = "2026-01-02T00:00:00Z";
const comment = (
  id: string,
  user = "a",
  body = defaultMarkers.approve,
  extra: Partial<ReviewComment> = {},
): ReviewComment => ({
  id,
  body,
  user: { id: user, name: user },
  createdAt: "2026-01-03T00:00:00Z",
  updatedAt: "2026-01-03T00:00:00Z",
  inline: false,
  ...extra,
});
const calc = (
  cs: ReviewComment[],
  p: ReviewPolicy | undefined = policy,
  round: string | undefined = boundary,
) => calculateReview(p, "owner", cs, round, "review");
describe("strict review markers", () => {
  it.each([
    "> [REVIEW: APPROVE]",
    "```text\n[REVIEW: APPROVE]\n```",
    "~~~\n[REVIEW: APPROVE]\n~~~",
    "I approve this",
    "please [REVIEW: APPROVE]",
    "    [REVIEW: APPROVE]",
    "<!--\n[REVIEW: APPROVE]\n-->",
  ])("ignores non-formal marker %s", (body) =>
    expect(parseMarker(body, defaultMarkers)).toBeNull(),
  );
  it("supports case and explanation", () =>
    expect(
      parseMarker("[review: approve]\n\nLooks fine.", defaultMarkers),
    ).toBe("approve"));
  it("rejects conflicting decisions within one comment", () =>
    expect(
      parseMarker("[REVIEW: APPROVE]\n[REVIEW: HOLD]", defaultMarkers),
    ).toBeNull());
});
describe("review decisions and rounds", () => {
  it("requires two distinct reviewers", () =>
    expect(calc([comment("1"), comment("2", "b")]).status).toBe(
      "Review Passed",
    ));
  it("one approval is partial", () =>
    expect(calc([comment("1")]).status).toBe("Partially Approved"));
  it("duplicates count once", () =>
    expect(calc([comment("1"), comment("2")]).approvals).toBe(1));
  it("no decision is pending", () => expect(calc([]).status).toBe("Pending"));
  it("requests changes", () =>
    expect(
      calc([comment("1", "a", defaultMarkers.requestChanges)]).status,
    ).toBe("Changes Requested"));
  it("holds", () =>
    expect(calc([comment("1", "a", defaultMarkers.hold)]).status).toBe(
      "On Hold",
    ));
  it("later approval replaces own request", () =>
    expect(
      calc([
        comment("1", "a", defaultMarkers.requestChanges),
        comment("2", "a", defaultMarkers.approve, {
          updatedAt: "2026-01-04T00:00:00Z",
        }),
        comment("3", "b"),
      ]).status,
    ).toBe("Review Passed"));
  it("other reviewer request still blocks", () =>
    expect(
      calc([comment("1"), comment("2", "b", defaultMarkers.requestChanges)])
        .status,
    ).toBe("Changes Requested"));
  it("excludes assignee and unconfigured commenter", () =>
    expect(
      calc([comment("1", "owner"), comment("2", "stranger")]).approvals,
    ).toBe(0));
  it("ignores inline description comments", () =>
    expect(
      calc([comment("1", "a", defaultMarkers.approve, { inline: true })])
        .approvals,
    ).toBe(0));
  it("old comments cannot become current by editing after boundary", () =>
    expect(
      calc([
        comment("1", "a", defaultMarkers.approve, {
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-04T00:00:00Z",
        }),
      ]).approvals,
    ).toBe(0));
  it("recalculates edited comments including marker removal", () => {
    expect(calc([comment("1", "a", "No marker after edit")]).approvals).toBe(0);
    expect(
      calc([
        comment("1", "a", defaultMarkers.hold, {
          updatedAt: "2026-01-05T00:00:00Z",
        }),
      ]).status,
    ).toBe("On Hold");
  });
  it("missing or disabled policy is not configured", () => {
    expect(calculateReview(undefined, "owner", []).status).toBe(
      "Not Configured",
    );
    expect(calc([], { ...policy, enabled: false }).status).toBe(
      "Not Configured",
    );
  });
  it("unknown round never reports passed", () =>
    expect(
      calculateReview(
        policy,
        "owner",
        [comment("1"), comment("2", "b")],
        undefined,
        "review",
      ).status,
    ).toBe("Verification Required"));
  it("outside In Review never treats stale approvals as passed", () =>
    expect(
      calculateReview(
        policy,
        "owner",
        [comment("1"), comment("2", "b")],
        boundary,
        "done",
      ).status,
    ).toBe("Verification Required"));
  it("latest true transition is the boundary", () =>
    expect(
      roundBoundary(
        [
          {
            createdAt: "2026-01-01Z",
            fromStateId: "todo",
            toStateId: "review",
          },
          { createdAt: boundary, fromStateId: "todo", toStateId: "review" },
          {
            createdAt: "2026-01-04Z",
            fromStateId: "review",
            toStateId: "review",
          },
        ],
        ["review"],
      ),
    ).toBe(boundary));
  it("successful deletion refresh removes approval", () => {
    expect(calc([comment("1"), comment("2", "b")]).status).toBe(
      "Review Passed",
    );
    expect(calc([comment("1")]).status).toBe("Partially Approved");
  });
});

it("requires creation strictly after the transition even when edited later", () =>
  expect(calc([comment("same", "a", defaultMarkers.approve, { createdAt: boundary })]).approvals).toBe(0));

describe("standalone decision vocabulary", () => {
  it.each([["approved","approve"],[" Approved WITH comments ","approve"],
    ["Request changes","requestChanges"],["Changes requested","requestChanges"],
    ["Hold","hold"],["On hold","hold"]])("accepts %s with explanation", (line, decision) =>
    expect(parseMarker(line+"\n\nSee my observations.", defaultMarkers)).toBe(decision));
  it.each(["I think this is approved.","Not approved yet.","We may approve it later.",
    "The previous reviewer said Approved.","> Approved","~~~\nApproved\n~~~","    Approved",
    "<!--\nApproved\n-->","Approved\nHold","  \tApproved","<!-- first --> <!-- second\nApproved\n-->"])("rejects %s", body =>
    expect(parseMarker(body, defaultMarkers)).toBeNull());
  it("applies identity and round rules to ordinary commands", () => {
    const decisions=[comment("1","a","Approved"),comment("2","b","Approved with comments")];
    expect(calc(decisions).status).toBe("Review Passed");
    expect(calc([...decisions,comment("3","b","On hold")]).status).toBe("On Hold");
    expect(calc([comment("old","b","Approved",{createdAt:boundary})]).approvals).toBe(0);
  });
});
