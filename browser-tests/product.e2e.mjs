import { test, expect } from "@playwright/test";

for (const width of [375, 390, 768, 1280, 1440]) {
  test.describe(`viewport ${width}`, () => {
    test.use({viewport: { width, height: 900 }, hasTouch: width < 800});
    test("navigate, filter, open details and restore modal focus", async ({ page }) => {
      const button = name => page.getByRole("button", {name, exact:true});
      const activate = locator => width < 800 ? locator.tap() : locator.click();
      await page.goto("./");
      await activate(button("体验合成演示"));
      await activate(button("团队配置"));
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(button("团队配置")).toBeFocused();
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
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
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
    await expect(page.getByText(new RegExp(`^${count} 节点 · [0-9]+ 条可见关系$`))).toBeVisible({timeout:30000});
    await page.locator(".react-flow__node").first().waitFor();
    const elapsed = await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(performance.now())))));
    console.log(`browser fixture-to-layout-and-paint ${count}: ${Math.round(elapsed-start)} ms`);
  }
  const viewport = page.locator(".react-flow__viewport");
  const search = page.getByLabel("搜索任务");
  await search.fill("SCALE-50");
  await expect(page.locator(".react-flow__node").filter({hasText:"SCALE-50"}).first()).toBeVisible();
  await page.locator(".react-flow__node").filter({hasText:"SCALE-50"}).first().click();
  const transform = await viewport.evaluate(e=>e.style.transform);
  await button("关闭详情").click();
  expect(await viewport.evaluate(e=>e.style.transform)).toBe(transform);
});
