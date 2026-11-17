import { describe, it, expect, vi, beforeEach } from "vitest";
function memory() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) || null,
    setItem: (k: string, v: string) => m.set(k, v),
    removeItem: (k: string) => m.delete(k),
  };
}
beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("localStorage", memory());
  vi.stubGlobal("sessionStorage", memory());
  vi.stubGlobal("location", {
    origin: "https://example.test",
    pathname: "/",
    search: "",
    assign: vi.fn(),
  });
  vi.stubGlobal("history", { replaceState: vi.fn() });
});
describe("OAuth protection", () => {
  it("requests only read scope with S256 and user actor", async () => {
    const auth = await import("../src/auth");
    await auth.login("public-test-client");
    const url = new URL((location.assign as any).mock.calls[0][0]);
    expect(url.searchParams.get("scope")).toBe("read");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("actor")).toBe("user");
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.get("code_challenge")?.length).toBe(43);
  });
  it("rejects mismatched state and removes the transaction", async () => {
    const auth = await import("../src/auth");
    await auth.login("public-test-client");
    location.search = "?code=synthetic&state=incorrect";
    await expect(auth.finishLogin()).rejects.toThrow("状态");
    expect(sessionStorage.getItem("pvcr-oauth")).toBeNull();
    expect(history.replaceState).toHaveBeenCalled();
  });
  it("rejects expired authorization", async () => {
    const auth = await import("../src/auth");
    sessionStorage.setItem(
      "pvcr-oauth",
      JSON.stringify({
        state: "s",
        created: Date.now() - 700000,
        redirect: "https://example.test/",
      }),
    );
    location.search = "?code=synthetic&state=s";
    await expect(auth.finishLogin()).rejects.toThrow("过期");
  });
  it("fails closed on a broader returned scope", async () => {
    const auth = await import("../src/auth");
    await auth.login("public-test-client");
    const transaction = JSON.parse(sessionStorage.getItem("pvcr-oauth")!);
    location.search = `?code=synthetic&state=${transaction.state}`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "synthetic-only",
          refresh_token: "synthetic-only",
          scope: "read write",
          expires_in: 3600,
        }),
      }),
    );
    await expect(auth.finishLogin()).rejects.toThrow("仅接受 read");
    await expect(auth.accessToken()).rejects.toThrow("连接");
  });
  it("stores credentials only in memory and clears them on disconnect", async () => {
    const auth = await import("../src/auth");
    await auth.login("public-test-client");
    const t = JSON.parse(sessionStorage.getItem("pvcr-oauth")!);
    location.search = `?code=synthetic&state=${t.state}`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "synthetic-only",
          refresh_token: "synthetic-only",
          scope: "read",
          expires_in: 3600,
        }),
      }),
    );
    expect(await auth.finishLogin()).toBe(true);
    expect(await auth.accessToken()).toBe("synthetic-only");
    expect(sessionStorage.getItem("pvcr-oauth")).toBeNull();
    auth.disconnect();
    await expect(auth.accessToken()).rejects.toThrow("连接");
  });
  it("serializes concurrent renewals and uses the rotated refresh token next time", async () => {
    const auth = await import("../src/auth");
    await auth.login("public-test-client");
    const t = JSON.parse(sessionStorage.getItem("pvcr-oauth")!);
    location.search = `?code=synthetic&state=${t.state}`;
    let version = 0;
    const fetchMock = vi.fn(async () => {
      version++;
      const v = version;
      return {
        ok: true,
        json: async () => ({
          access_token: `synthetic-access-${v}`,
          refresh_token: `synthetic-refresh-${v}`,
          scope: "read",
          expires_in: 3600,
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    await auth.finishLogin();
    await Promise.all([auth.renewSession(), auth.renewSession()]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await auth.accessToken()).toBe("synthetic-access-2");
    await auth.renewSession();
    expect(String((fetchMock.mock.calls as any)[2][1].body)).toContain(
      "refresh_token=synthetic-refresh-2",
    );
    expect(String((fetchMock.mock.calls as any)[2][1].body)).not.toContain(
      "client_secret",
    );
  });
  it("disconnect prevents an in-flight renewal from resurrecting credentials", async () => {
    const auth = await import("../src/auth");
    await auth.login("public-test-client");
    const t = JSON.parse(sessionStorage.getItem("pvcr-oauth")!);
    location.search = `?code=synthetic&state=${t.state}`;
    const token = {
      access_token: "synthetic-access",
      refresh_token: "synthetic-refresh",
      scope: "read",
      expires_in: 3600,
    };
    let complete!: (v: any) => void;
    const f = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => token })
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            complete = r;
          }),
      );
    vi.stubGlobal("fetch", f);
    await auth.finishLogin();
    const renewal = auth.renewSession();
    auth.disconnect();
    complete({ ok: true, json: async () => token });
    await expect(renewal).rejects.toThrow();
    await expect(auth.accessToken()).rejects.toThrow("连接");
  });
});
