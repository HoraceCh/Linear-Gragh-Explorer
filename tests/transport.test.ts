import { it, expect, vi, afterEach } from "vitest";
vi.mock("../src/auth", () => ({ accessToken: async () => "synthetic-access" }));
import { directTransport } from "../src/api";
afterEach(() => vi.unstubAllGlobals());
it("retries rate limits and succeeds without widening query", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({
      status: 429,
      ok: false,
      headers: new Headers({ "Retry-After": "0.001" }),
      json: async () => ({}),
    })
    .mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ data: { ok: true } }),
    });
  vi.stubGlobal("fetch", fetcher);
  expect(await directTransport("query Read { viewer { id } }", {})).toEqual({
    ok: true,
  });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
});
it("partial GraphQL errors reject whole result", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          data: { partial: true },
          errors: [{ message: "permission" }],
        }),
      }),
  );
  await expect(
    directTransport("query Read { viewer { id } }", {}),
  ).rejects.toThrow("未完整");
});
it("never sends a mutation", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(
    directTransport("mutation Write { issueUpdate { success } }", {}),
  ).rejects.toThrow("只读");
  expect(fetcher).not.toHaveBeenCalled();
});
it("preaborted requests never fetch", async () => {
  const c = new AbortController();
  c.abort();
  const f = vi.fn();
  vi.stubGlobal("fetch", f);
  await expect(
    directTransport("query Read { viewer { id } }", {}, c.signal),
  ).rejects.toThrow();
  expect(f).not.toHaveBeenCalled();
});
it("network failures remain failures", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  await expect(
    directTransport("query Read { viewer { id } }", {}),
  ).rejects.toThrow("offline");
});
