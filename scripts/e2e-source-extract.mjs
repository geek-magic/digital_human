import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:8083";
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const outDir = join(process.cwd(), "storage", "e2e-source-extract");
mkdirSync(outDir, { recursive: true });

const shareText = process.env.E2E_SOURCE_SHARE || `独立解析验证-${Date.now()}：这是一段普通文本，不应该进入任务五步节点。`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({
  headless: true,
  executablePath: existsSync(chromePath) ? chromePath : undefined
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "任务中心" }).waitFor({ timeout: 30000 });
  await page.getByLabel("链接解析输入").fill(shareText);
  await page.screenshot({ path: join(outDir, "01-before-extract.png"), fullPage: true });
  await page.getByRole("button", { name: "提取" }).click();
  await page.getByText(shareText.slice(0, 18), { exact: false }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "填入新任务输入" }).click();
  await page.waitForFunction((expected) => {
    const input = document.querySelector("textarea[required]");
    return input && input.value.includes(expected);
  }, shareText.slice(0, 18), { timeout: 30000 });
  const textareaValue = await page.getByRole("textbox", { name: "原始输入" }).inputValue();
  const navTexts = await page.locator(".step-nav .step-tab strong").allTextContents().catch(() => []);
  await page.screenshot({ path: join(outDir, "02-after-extract.png"), fullPage: true });

  assert(textareaValue.includes(shareText.slice(0, 18)), `原始输入没有接收解析结果：${textareaValue}`);
  assert(!navTexts.some((item) => /来源|解析/.test(item)), `任务节点仍包含来源解析：${navTexts.join(" / ")}`);
  assert(errors.length === 0, `Console/page errors found:\n${errors.join("\n")}`);

  console.log(JSON.stringify({ ok: true, textareaValue, screenshots: outDir }, null, 2));
  await browser.close();
} catch (error) {
  await browser.close().catch(() => undefined);
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
}
