import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:8083";
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const outDir = join(process.cwd(), "storage", "e2e");
mkdirSync(outDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function noHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  assert(metrics.scrollWidth <= metrics.innerWidth + 4, `${label} has horizontal overflow: ${JSON.stringify(metrics)}`);
}

async function screenshot(page, name) {
  await page.screenshot({ path: join(outDir, name), fullPage: true });
}

const browser = await chromium.launch({
  headless: true,
  executablePath: existsSync(chromePath) ? chromePath : undefined
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "任务中心" }).waitFor();
await noHorizontalOverflow(page, "tasks");
await screenshot(page, "01-tasks.png");

const marker = `流程验证-${Date.now()}`;
await page.getByRole("textbox", { name: "原始输入" }).fill(`${marker} 数字人口播流程验证。`);
await page.getByRole("textbox", { name: "生成要求" }).fill("验证手动模式、节点锁定和文案版本。");
await page.getByRole("button", { name: "创建手动任务" }).click();
await page.locator(".task-select").filter({ hasText: marker }).waitFor({ timeout: 30000 });
await page.locator(".task-select").filter({ hasText: marker }).click();
await page.locator(".detail-title h2").filter({ hasText: marker }).waitFor({ timeout: 30000 });

const navTexts = await page.locator(".step-nav .step-tab strong").allTextContents();
assert(navTexts.join(" > ") === "输入 > 生成口播文案 > 生成口播音频 > 视频合成 > 发布", `流程节点错误：${navTexts.join(" / ")}`);
await page.locator(".step-nav button").filter({ hasText: "生成口播文案" }).click();
await page.locator(".step-body textarea").first().fill(`${marker} 口播文案 V1。`);
await page.getByRole("button", { name: "保存为新版本" }).click();
await page.getByText("V1", { exact: false }).first().waitFor({ timeout: 30000 });
await noHorizontalOverflow(page, "task detail");
await screenshot(page, "02-task-detail.png");

await page.getByRole("button", { name: "音色库" }).click();
await page.locator("h1", { hasText: "音色库" }).waitFor();
await noHorizontalOverflow(page, "voices");
await screenshot(page, "03-voices.png");

await page.getByRole("button", { name: "模型中心" }).click();
await page.getByRole("heading", { name: "模型选择", exact: false }).waitFor();
await noHorizontalOverflow(page, "models");
await screenshot(page, "04-models.png");

assert(errors.length === 0, `Console/page errors found:\n${errors.join("\n")}`);

await browser.close();
console.log(JSON.stringify({ ok: true, screenshots: outDir }, null, 2));
