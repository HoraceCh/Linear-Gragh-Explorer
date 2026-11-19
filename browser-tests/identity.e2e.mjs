import { test, expect } from "@playwright/test";

test("independent browser sessions and account replacement use their own bearer", async ({ browser, baseURL }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  async function connect(page, user, authorizedTeams = []) {
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
      const {query, variables} = route.request().postDataJSON();
      const conn = nodes => ({nodes,pageInfo:{hasNextPage:false,endCursor:null}});
      let data;
      if (query.includes("SessionIdentity")) data = {viewer:{id:user,organization:{id:"example-space"}}};
      else if (query.includes("AccessibleTeams")) data = {teams:conn(authorizedTeams)};
      else {
        const selected = authorizedTeams.find(t=>t.id === (variables.id || variables.team));
        if (!selected) return route.fulfill({status:403,json:{errors:[{message:"denied"}]}});
        if (query.includes("TeamPermission")) data = {team:selected};
        else if (query.includes("SelectedTeamProjects")) data = {team:{projects:conn([])}};
        else if (query.includes("SelectedTeamIssues")) data = {issues:conn([])};
        else if (query.includes("TeamMetadata")) {
          const field = ["members","states","labels"].find(k=>query.includes(k+"("));
          data = {team:{[field]:conn([])}};
        } else throw Error("Unexpected fixture operation");
      }
      return route.fulfill({json:{data}});
    });
    await page.goto(root+"?code=synthetic&state="+user);
    if (authorizedTeams.length) await expect(page.getByText(/上次完整同步/)).toBeVisible();
    else await expect.poll(() => seen.length).toBe(2);
    expect(new Set(seen)).toEqual(new Set(["Bearer fixture-"+user]));
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
    const shared = {id:"shared",name:"Shared fixture",key:"SH"};
    const restricted = {id:"restricted",name:"Private fixture",key:"PR"};
    await Promise.all([connect(p,"a",[restricted,shared]),connect(q,"b",[shared])]);
    const selector = page => page.getByRole("combobox",{name:"选择团队"});
    await expect(selector(p)).toHaveValue(restricted.id);
    await expect(selector(q)).toHaveValue(shared.id);
    await expect(selector(q).getByRole("option",{name:/Private fixture/})).toHaveCount(0);
    await p.getByRole("button",{name:"连接设置"}).click();
    await p.getByRole("button",{name:"断开本地会话"}).click();
    await connect(p,"b",[shared]);
    await expect(selector(p)).toHaveValue(shared.id);
    await expect(selector(p).getByRole("option",{name:/Private fixture/})).toHaveCount(0);
  } finally { await first.close(); await second.close(); }
});
