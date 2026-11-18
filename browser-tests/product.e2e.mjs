import { test, expect } from "@playwright/test";

for (const width of [375, 390, 768, 1280, 1440]) {
  test.describe(`viewport ${width}`, () => {
    test.use({viewport: { width, height: 900 }, hasTouch: width < 800});
    test("navigate, filter, open details and restore modal focus", async ({ page }) => {
      const button = name => page.getByRole("button", {name, exact:true});
      const activate = locator => width < 800 ? locator.tap() : locator.click();
      await page.goto("./");
      await activate(button("体验合成演示"));
      await expect(page.getByRole("region",{name:"项目索引"})).toHaveCount(0);
      await activate(button("项目探索"));
      const index = page.getByRole("region",{name:"项目索引"});
      await expect(index).toBeVisible();
      await activate(button("切换深浅色"));
      await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
      await activate(button("切换深浅色"));
      await expect(page.locator("html")).toHaveAttribute("data-theme","light");
      await index.getByLabel("搜索项目").fill("no-project-ever");
      await expect(index.getByText("没有匹配项目。")).toBeVisible();
      await index.getByLabel("搜索项目").fill("");
      await activate(index.locator(".project-card").first());
      const workspace = page.getByRole("region",{name:"项目工作区"});
      await workspace.getByLabel("搜索项目任务").fill("no-match-ever");
      await expect(workspace.getByText("当前没有匹配任务。")).toBeVisible();
      await workspace.getByLabel("搜索项目任务").fill("");
      await activate(workspace.locator(".project-task-row").first());
      await activate(button("关闭详情"));
      await activate(button("返回项目索引"));
      await expect(index).toBeVisible();
      await activate(button("团队总览"));
      await expect(index).toHaveCount(0);
      await activate(button("视图与审阅设置"));
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(button("视图与审阅设置")).toBeFocused();
      await activate(button("层级视图"));
      await expect(page.getByLabel("全部角色")).toBeHidden();
      await activate(page.getByText("更多筛选",{exact:true}));
      await expect(page.getByLabel("全部角色")).toBeVisible();
      await page.getByLabel("搜索任务").fill("no-match-ever");
      await expect(page.locator(".tree-title")).toHaveCount(0);
      await activate(button("清空筛选（1）"));
      await activate(page.locator(".tree-title").first());
      await expect(button("关闭详情")).toBeVisible();
      await activate(button("关闭详情"));
      const overflow = await page.evaluate(() => [...document.querySelectorAll("body *")].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => e.tagName + "." + e.className).slice(0,8));
      expect(await page.evaluate(()=>document.documentElement.scrollWidth), overflow.join(", ")).toBeLessThanOrEqual(width);
    });
  });
}

test("synthetic layout, search and selection in Chromium", async ({page}) => {
  const button = name => page.getByRole("button",{name,exact:true});
  await page.goto("./");
  await button("体验合成演示").click();
  await button("依赖视图").click();
  for (const count of [20,50,100,200]) {
    const start = await page.evaluate(()=>performance.now());
    await button(`${count} 节点压力图`).click();
    await expect(page.getByRole("status")).toHaveText(new RegExp(`^${count} 节点 · [0-9]+ 条可见关系\\s*$`), {timeout:30000});
    await expect(button("适应全图")).toBeEnabled();
    await page.locator(".react-flow__node").first().waitFor();
    const elapsed = await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(performance.now())))));
    console.log(`browser fixture-to-layout-and-paint ${count}: ${Math.round(elapsed-start)} ms`);
  }
  const viewport = page.locator(".react-flow__viewport");
  const search = page.getByLabel("搜索任务");
  const searchStart = await page.evaluate(() => performance.now());
  await search.fill("SCALE-50");
  await expect(page.locator(".react-flow__node").filter({hasText:"SCALE-50"}).first()).toBeVisible();
  console.log("200-node search to visible match:", Math.round(await page.evaluate(() => performance.now()) - searchStart), "ms");
  await page.locator(".react-flow__node").filter({hasText:"SCALE-50"}).first().click();
  const transform = await viewport.evaluate(e=>e.style.transform);
  await button("关闭详情").click();
  expect(await viewport.evaluate(e=>e.style.transform)).toBe(transform);
});

test("an updated entry prompts before the in-memory session is reloaded", async ({page}) => {
  await page.goto("./");
  await page.getByRole("button",{name:"体验合成演示"}).click();
  await page.route("**/", route => route.fulfill({contentType:"text/html",body:'<script type="module" src="./assets/next-12345678.js"></script>'}));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("button",{name:"载入新版"})).toBeVisible();
  await expect(page.getByRole("button",{name:"退出演示"})).toBeVisible();
});

test.describe("touch graph", () => {
  test.use({viewport:{width:390,height:844}, hasTouch:true, reducedMotion:"reduce"});
  test("two contacts zoom the graph while the minimap is hidden", async ({page, context}) => {
    await page.goto("./");
    const button = name => page.getByRole("button",{name,exact:true});
    await button("体验合成演示").tap();
    await button("依赖视图").tap();
    await expect(button("适应全图")).toBeEnabled();
    await page.getByRole("checkbox",{name:"小地图"}).uncheck();
    const pane = page.locator(".react-flow__pane");
    await pane.scrollIntoViewIfNeeded();
    const box = await pane.boundingBox();
    const x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
    const transform = () => page.locator(".react-flow__viewport").evaluate(e => new DOMMatrix(getComputedStyle(e).transform).a);
    const initial = await transform();
    const session = await context.newCDPSession(page);
    try {
      for (const distance of [20,30,40,55,70]) {
        await session.send("Input.dispatchTouchEvent", {type:distance===20?"touchStart":"touchMove",
          touchPoints:[{id:1,x:x-distance,y},{id:2,x:x+distance,y}]});
        await page.evaluate(() => new Promise(requestAnimationFrame));
      }
      await session.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
      await expect.poll(transform).toBeGreaterThan(initial);
    } finally { await session.detach(); }
  });
});

test("wheel anchors zoom at cursor and middle drag pans only the canvas", async ({page}) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("./");
  const button = name => page.getByRole("button",{name,exact:true});
  await button("体验合成演示").click();
  await button("依赖视图").click();
  await expect(button("适应全图")).toBeEnabled();
  const pane = page.locator(".react-flow__pane");
  await pane.scrollIntoViewIfNeeded();
  const box = await pane.boundingBox();
  const x = Math.round(box.x+box.width*.63), y = Math.round(box.y+box.height*.42);
  const read = () => page.locator(".react-flow__viewport").evaluate(el=>{
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return {z:m.a,x:m.e,y:m.f,scroll:scrollY};
  });
  await page.mouse.move(x,y);
  const before=await read();
  await page.mouse.wheel(0,100);
  await expect.poll(async()=>(await read()).z/before.z).toBeLessThan(.95);
  const zoomed=await read(), ratio=zoomed.z/before.z;
  expect(ratio).toBeGreaterThan(.92);
  expect(Math.abs(zoomed.x-(x-box.x+(before.x-x+box.x)*ratio))).toBeLessThan(2);
  expect(Math.abs(zoomed.y-(y-box.y+(before.y-y+box.y)*ratio))).toBeLessThan(2);
  await page.mouse.down({button:"middle"});
  await page.mouse.move(x+45,y+30,{steps:5});
  await page.mouse.up({button:"middle"});
  const panned=await read();
  expect(panned.x-zoomed.x).toBeCloseTo(45,0);
  expect(panned.y-zoomed.y).toBeCloseTo(30,0);
  expect(panned.scroll).toBe(before.scroll);
  await button("适应全图").click();
  await page.getByRole("checkbox",{name:"小地图",exact:true}).check();
  await expect(page.locator(".react-flow__minimap")).toBeVisible();
  await page.locator(".react-flow__node").first().click();
  await expect(button("关闭详情")).toBeVisible();
});


test("review queue finds In Review candidates independently of hierarchy search", async ({page}) => {
 const button=name=>page.getByRole("button",{name,exact:true});
 await page.goto("./");
 await button("体验合成演示").click();
 await button("层级视图").click();
 await page.getByLabel("搜索任务").fill("no-such-task");
 await button("审阅队列").click();
 const queue=page.getByRole("region",{name:"审阅队列"});
 await expect(queue).toBeVisible();
 await expect(queue.getByText(/In Review 候选/)).toBeVisible();
 await expect(queue.getByText("DEMO-12")).toBeVisible();
 await expect(queue.getByText(/尚未启用审阅规则/)).toBeVisible();
});
