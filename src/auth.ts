import { LinearAccessError } from "./team/access-error";
const AUTH = "https://linear.app/oauth/authorize",
  TOKEN = "https://api.linear.app/oauth/token";
let credentials: {
  access_token: string;
  refresh_token: string;
  expiresAt: number;
  clientId: string;
} | null = null;
let authGeneration = 0;
let refreshing: Promise<string> | null = null;
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
const random = () => encode(crypto.getRandomValues(new Uint8Array(32)));
export const configuredClient = () =>
  localStorage.getItem("lge-client-id") || localStorage.getItem("pvcr-client-id") ||
  import.meta.env.VITE_LINEAR_CLIENT_ID ||
  "";
export const callbackUrl = () => location.origin + location.pathname;
export function callbackAllowed(current: string, registered: string | undefined, vercel: boolean) {
  if (!registered) return !vercel;
  try {
    const url = new URL(registered);
    return url.href === current && !url.search && !url.hash && url.protocol === "https:";
  } catch { return false; }
}
export const liveOAuthAllowed = () => callbackAllowed(callbackUrl(), import.meta.env.VITE_LINEAR_REDIRECT_URI, import.meta.env.VITE_VERCEL_HOSTED === "true" || new URL(callbackUrl()).hostname.endsWith(".vercel.app"));
export async function login(clientId: string) {
  if (!liveOAuthAllowed()) throw new Error("此地址未配置固定 OAuth 回调，请使用合成演示或已注册的稳定入口。");
  if (!clientId.trim()) throw new Error("请先配置公开 OAuth Client ID。");
  const verifier = random(),
    state = random();
  const challenge = encode(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );
  sessionStorage.setItem(
    "pvcr-oauth",
    JSON.stringify({
      verifier,
      state,
      created: Date.now(),
      redirect: callbackUrl(),
      clientId,
    }),
  );
  localStorage.setItem("lge-client-id", clientId);
  location.assign(
    AUTH +
      "?" +
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl(),
        response_type: "code",
        scope: "read",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
        actor: "user",
      }),
  );
}
async function exchange(params: Record<string, string>) {
  const generation = authGeneration;
  const r = await fetch(TOKEN, {
    method: "POST", cache: "no-store", credentials: "omit",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) {
    const failure = await r.json().catch(() => null);
    if (r.status === 401 || r.status === 403 || failure?.error === "invalid_grant" || failure?.error === "invalid_client")
      throw new LinearAccessError("Linear 授权已失效，请重新连接。");
    throw new Error("OAuth 令牌交换暂时失败，请重试。");
  }
  const t = await r.json();
  const scopes = Array.isArray(t.scope)
    ? t.scope
    : String(t.scope || "").split(/[ ,]+/);
  if (
    typeof t.access_token !== "string" || !t.access_token ||
    typeof t.refresh_token !== "string" || !t.refresh_token ||
    !Number.isFinite(t.expires_in) || t.expires_in <= 0 ||
    scopes.some((s: string) => s && s !== "read") ||
    !scopes.includes("read")
  )
    throw new LinearAccessError("授权范围或令牌响应异常：仅接受 read。");
  if (generation !== authGeneration)
    throw new DOMException("Authorization canceled", "AbortError");
  credentials = {
    clientId: params.client_id,
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expiresAt: Date.now() + t.expires_in * 1000,
  };
  return t.access_token as string;
}
export async function finishLogin() {
  const p = new URLSearchParams(location.search);
  if (!p.has("code") && !p.has("error")) return false;
  const raw = sessionStorage.getItem("pvcr-oauth");
  sessionStorage.removeItem("pvcr-oauth");
  history.replaceState({}, "", callbackUrl());
  if (!liveOAuthAllowed()) throw new Error("回调地址不在本部署的授权范围内。");
  if (p.has("error")) throw new Error("Linear 授权未完成。");
  const saved = raw ? JSON.parse(raw) : null;
  if (
    !saved ||
    typeof saved.verifier !== "string" || !saved.verifier ||
    typeof saved.state !== "string" || !saved.state ||
    typeof saved.clientId !== "string" || !saved.clientId ||
    !Number.isFinite(saved.created) || saved.created > Date.now() ||
    p.get("state") !== saved.state ||
    Date.now() - saved.created > 600000 ||
    saved.redirect !== callbackUrl()
  )
    throw new Error("授权状态无效或已过期，请重新连接。");
  await exchange({
    grant_type: "authorization_code",
    client_id: saved.clientId,
    code: p.get("code")!,
    code_verifier: saved.verifier,
    redirect_uri: saved.redirect,
  });
  return true;
}
export async function accessToken() {
  if (!credentials) throw new Error("请连接 Linear。页面重载后需要重新授权。");
  if (credentials.expiresAt > Date.now() + 60000)
    return credentials.access_token;
  if (!refreshing) {
    const generation = authGeneration;
    const pending = exchange({
      grant_type: "refresh_token",
      client_id: credentials.clientId,
      refresh_token: credentials.refresh_token,
    })
      .catch((e) => {
        if (generation === authGeneration && e instanceof LinearAccessError) credentials = null;
        throw e;
      })
      .finally(() => {
        if (refreshing === pending) refreshing = null;
      });
    refreshing = pending;
  }
  return refreshing;
}
export function disconnect() {
  authGeneration++;
  refreshing = null;
  credentials = null;
  sessionStorage.removeItem("pvcr-oauth");
}

// Manual renewal uses the same single-flight refresh path as expiry renewal.
export async function renewSession(): Promise<void> {
  if (!credentials) throw new Error("请先连接 Linear。");
  credentials.expiresAt = 0;
  await accessToken();
}
