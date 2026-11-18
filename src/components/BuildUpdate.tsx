import { useEffect, useState } from "react";

export function BuildUpdate() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src;
    if (!entry || !import.meta.env.PROD) return;
    const abort = new AbortController();
    let lastCheck = 0;
    async function check() {
      if (document.hidden || Date.now() - lastCheck < 60000) return;
      lastCheck = Date.now();
      try {
        const response = await fetch(location.pathname, { cache: "no-store", signal: abort.signal });
        if (!response.ok || new URL(response.url).origin !== location.origin) return;
        const html = new DOMParser().parseFromString(await response.text(), "text/html");
        const src = html.querySelector('script[type="module"][src]')?.getAttribute("src");
        if (!abort.signal.aborted && src && new URL(src, response.url).href !== entry) setAvailable(true);
      } catch { /* A failed version check leaves the active session untouched. */ }
    }
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      abort.abort();
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return available ? <div role="status" className="notice">有新版本。重新载入后需重新连接 Linear。
    <button onClick={() => location.reload()}>载入新版</button></div> : null;
}
