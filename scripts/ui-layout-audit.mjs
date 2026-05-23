import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:8083";
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const outDir = join(process.cwd(), "storage", "ui-audit");
mkdirSync(outDir, { recursive: true });

const pages = ["任务中心", "素材库", "音色库", "模型中心", "发布历史"];
const viewports = [
  { width: 1440, height: 960 },
  { width: 1280, height: 900 },
  { width: 1024, height: 800 },
  { width: 390, height: 844 }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertTaskListTouchScroll(page, context, viewport) {
  if (viewport.width > 760) return;
  const taskList = page.locator(".task-list");
  await taskList.waitFor();
  const initial = await taskList.evaluate((element) => ({
    scrollTop: element.scrollTop,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight
  }));
  if (initial.scrollHeight <= initial.clientHeight + 8) return;

  await taskList.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(100);
  const box = await taskList.boundingBox();
  assert(box, "任务列表没有可测量区域");

  const session = await context.newCDPSession(page);
  const x = Math.round(box.x + box.width / 2);
  const yStart = Math.round(Math.min(box.y + box.height - 24, viewport.height - 24));
  const yEnd = Math.round(Math.max(box.y + 24, 24));

  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: yStart, radiusX: 4, radiusY: 4, force: 1 }]
  });
  for (let i = 1; i <= 10; i += 1) {
    const y = Math.round(yStart + ((yEnd - yStart) * i) / 10);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y, radiusX: 4, radiusY: 4, force: 1 }]
    });
    await page.waitForTimeout(16);
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(250);

  const after = await taskList.evaluate((element) => element.scrollTop);
  assert(after > initial.scrollTop, `移动端任务列表无法触摸滚动：${JSON.stringify({ initial, after })}`);
}

const browser = await chromium.launch({
  headless: true,
  executablePath: existsSync(chromePath) ? chromePath : undefined
});

const findings = [];

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width <= 760,
    hasTouch: viewport.width <= 760,
    deviceScaleFactor: viewport.width <= 760 ? 3 : 1
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  for (const pageName of pages) {
    if (pageName !== "任务中心") {
      await page.getByRole("button", { name: pageName }).click();
    }
    await page.locator("h1", { hasText: pageName }).waitFor();
    const metrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      maxButtonWidth: Math.max(...Array.from(document.querySelectorAll("button")).map((button) => button.scrollWidth - button.clientWidth), 0)
    }));
    assert(metrics.scrollWidth <= metrics.innerWidth + 4, `${pageName} ${viewport.width}px horizontal overflow: ${JSON.stringify(metrics)}`);
    assert(metrics.maxButtonWidth <= 2, `${pageName} ${viewport.width}px button text overflow: ${JSON.stringify(metrics)}`);
    const fileName = `${viewport.width}-${pageName}.png`;
    await page.screenshot({ path: join(outDir, fileName), fullPage: true });
    if (pageName === "任务中心") {
      await assertTaskListTouchScroll(page, context, viewport);
    }
    findings.push({ viewport: viewport.width, page: pageName, screenshot: fileName });
  }
  assert(errors.length === 0, `Console/page errors at ${viewport.width}px:\n${errors.join("\n")}`);
  await context.close();
}

await browser.close();
console.log(JSON.stringify({ ok: true, findings, screenshots: outDir }, null, 2));
