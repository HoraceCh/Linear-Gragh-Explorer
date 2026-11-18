import assert from "node:assert/strict";
const { VITE_LINEAR_CLIENT_ID: client, VITE_LINEAR_REDIRECT_URI: redirect,
  VITE_BASE_PATH: base, ACTUAL_PAGES_URL: actual } = process.env;
assert(client?.trim(), "Missing public OAuth client ID");
assert(redirect, "Missing registered redirect URI");
const url = new URL(redirect);
assert(url.protocol === "https:" && !url.username && !url.password, "Expected HTTPS callback");
assert(redirect === url.origin + base && base.endsWith("/"), "Callback must exactly match build path");
if (actual !== undefined) assert.equal(redirect, actual, "Callback must match configured Pages URL");
