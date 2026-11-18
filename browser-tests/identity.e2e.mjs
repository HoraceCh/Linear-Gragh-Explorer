import { test, expect } from "@playwright/test";

test("independent browser sessions and account replacement use their own bearer", async ({ browser, baseURL }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  async function connect(page, user) {
    const root = process.env.E2E_CALLBACK_URL || new URL("./", baseURL).href;
    await page.unrouteAll({behavior:"wait"});
    if (process.env.E2E_CALLBACK_URL) {
      await page.route(new URL(root).origin + "/**", async route => {
        const requested = new URL(route.request().url());
        const response = await route.fetch({ url: new URL(requested.pathname + requested.search, baseURL).href });
        await route.fulfill({response});
      });
    }
    await page.goto(root);
    await page.evaluate(({ root, user }) => sessionStorage.setItem("pvcr-oauth", JSON.stringify({
      verifier: "synthetic-verifier", state: user, clientId: "synthetic-client", created: Date.now(), redirect: root
    })), { root, user });
    await page.route("https://api.linear.app/oauth/token", route => route.fulfill({json:{
      scope:"read", expires_in:3600, access_token:"fixture-"+user, refresh_token:"renew-"+user
    }}));
    const seen = [];
    await page.route("https://api.linear.app/graphql", route => {
      seen.push(route.request().headers().authorization);
      const data = route.request().postDataJSON().query.includes("SessionIdentity")
        ? {viewer:{id:user,organization:{id:"example-space"}}}
        : {teams:{nodes:[],pageInfo:{hasNextPage:false,endCursor:null}}};
      return route.fulfill({json:{data}});
    });
    await page.goto(root+"?code=synthetic&state="+user);
    await expect.poll(() => seen.length).toBe(2);
    expect(seen).toEqual(["Bearer fixture-"+user,"Bearer fixture-"+user]);
    expect(page.url()).toBe(root);
    expect(await page.evaluate(() => JSON.stringify([localStorage,sessionStorage]))).not.toContain("fixture-");
  }
  try {
    const p = await first.newPage(), q = await second.newPage();
    await Promise.all([connect(p,"a"),connect(q,"b")]);
    await p.getByRole("button",{name:"连接设置"}).click();
    await p.getByRole("button",{name:"断开本地会话"}).click();
    await expect(p.getByRole("button",{name:"连接 Linear",exact:true})).toBeVisible();
    await expect(q.getByRole("button",{name:"重新发现团队"})).toBeVisible();
    await connect(p,"c");
  } finally { await first.close(); await second.close(); }
});
