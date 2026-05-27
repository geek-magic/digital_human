import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:8083";
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const outDir = join(process.cwd(), "storage", "e2e-p0-browser");
mkdirSync(outDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
await screenshot(page, "01-open.png");

const marker = `P0流程验证-${Date.now()}`;
await page.getByLabel("链接解析输入").fill(`${marker}：独立解析工具文本。`);
await page.getByRole("button", { name: "提取" }).click();
await page.getByText(marker).waitFor({ timeout: 30000 });
await page.getByRole("button", { name: "一键添加" }).click();
const composer = page.locator("form").first();
await composer.getByRole("textbox", { name: "任务标题" }).fill(marker);
await composer.getByPlaceholder("输入主题、需求、参考信息").fill(`${marker} 输入内容：验证四个生产节点、手动模式和版本化。`);
await composer.getByRole("textbox", { name: "生成要求" }).fill("不要调用重型模型，只验证 P0 交互结构。");
await page.getByRole("button", { name: "创建手动任务" }).click();
await page.locator(".task-select").filter({ hasText: marker }).waitFor({ timeout: 30000 });
await page.locator(".task-select").filter({ hasText: marker }).click();
await page.locator(".detail-title h2").filter({ hasText: marker }).waitFor({ timeout: 30000 });
await screenshot(page, "02-created-five-steps.png");

const navTexts = await page.locator(".step-nav .step-tab strong").allTextContents();
assert(JSON.stringify(navTexts) === JSON.stringify(["生成口播文案", "生成口播音频", "视频合成", "发布"]), `节点不符合生产流程：${navTexts.join(" / ")}`);
assert(!navTexts.some((item) => /来源|解析/.test(item)), "链接解析仍出现在任务流程节点里。");

const beforeVersions = await page.locator(".step-nav .step-tab").evaluateAll((nodes) => nodes.map((node) => ({
  text: node.textContent,
  disabled: node.disabled
})));
assert(beforeVersions[0].disabled === false, "文案节点应可点击。");
assert(beforeVersions[1].disabled === true, "没有文案版本前，音频节点应锁定。");
assert(beforeVersions[2].disabled === true, "没有音频版本前，视频节点应锁定。");
assert(beforeVersions[3].disabled === true, "没有视频版本前，发布节点应锁定。");

await page.locator(".step-nav button").filter({ hasText: "生成口播文案" }).click();
const scriptArea = page.locator(".step-body textarea").first();
await scriptArea.fill(`${marker} 口播文案第一版：每次保存都形成新的文案版本。`);
await page.getByRole("button", { name: "保存为口播文案" }).click();
await page.getByText("V1", { exact: false }).first().waitFor({ timeout: 30000 });
await scriptArea.fill(`${marker} 口播文案第二版：下游必须明确选择上游版本。`);
await page.getByRole("button", { name: "保存为口播文案" }).click();
await page.getByText("V2", { exact: false }).first().waitFor({ timeout: 30000 });
await screenshot(page, "03-script-versions.png");

const versionLabels = await page.locator(".version-panel .version-row strong").allTextContents();
assert(versionLabels.some((item) => item.startsWith("V1")), "没有生成 V1 文案版本。");
assert(versionLabels.some((item) => item.startsWith("V2")), "没有生成 V2 文案版本。");

const afterScript = await page.locator(".step-nav .step-tab").evaluateAll((nodes) => nodes.map((node) => ({
  text: node.textContent,
  disabled: node.disabled
})));
assert(afterScript[0].disabled === false && afterScript[1].disabled === false, "生成文案后，文案和音频节点应可点击。");
assert(afterScript[2].disabled === true && afterScript[3].disabled === true, "没有音频/视频版本前，视频和发布应锁定。");
assert(errors.length === 0, `浏览器控制台错误：\n${errors.join("\n")}`);

await browser.close();

console.log(JSON.stringify({
  ok: true,
  marker,
  navTexts,
  versionLabels,
  screenshots: outDir
}, null, 2));
