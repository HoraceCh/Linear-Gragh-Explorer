const AUTH = "https://linear.app/oauth/authorize",
  TOKEN = "https://api.linear.app/oauth/token";
let credentials: {
  access_token: string;
  refresh_token: string;
  expiresAt: number;
} | null = null;
let refreshing: Promise<string> | null = null;
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
const random = () => encode(crypto.getRandomValues(new Uint8Array(32)));
export const configuredClient = () =>
  localStorage.getItem("pvcr-client-id") ||
  (import.meta as any).env.VITE_LINEAR_CLIENT_ID ||
  "0a9b769e6c0b069413e6d61021734b81";
export const callbackUrl = () => location.origin + location.pathname;
export async function login(clientId: string) {
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
  localStorage.setItem("pvcr-client-id", clientId);
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
  const r = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error("OAuth 令牌交换失败，请重新授权。");
  const t = await r.json();
  const scopes = Array.isArray(t.scope)
    ? t.scope
    : String(t.scope || "").split(/[ ,]+/);
  if (
    !t.access_token ||
    !t.refresh_token ||
    scopes.some((s: string) => s && s !== "read") ||
    !scopes.includes("read")
  )
    throw new Error("授权范围异常：仅接受 read。");
  credentials = {
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
  if (p.has("error")) throw new Error("Linear 授权未完成。");
  const saved = raw ? JSON.parse(raw) : null;
  if (
    !saved ||
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
  if (!refreshing)
    refreshing = exchange({
      grant_type: "refresh_token",
      client_id: configuredClient(),
      refresh_token: credentials.refresh_token,
    })
      .catch((e) => {
        credentials = null;
        throw e;
      })
      .finally(() => {
        refreshing = null;
      });
  return refreshing;
}
export function disconnect() {
  credentials = null;
  sessionStorage.removeItem("pvcr-oauth");
}

// Manual renewal uses the same single-flight refresh path as expiry renewal.
export async function renewSession(): Promise<void> {
  if (!credentials) throw new Error("请先连接 Linear。");
  credentials.expiresAt = 0;
  await accessToken();
}
