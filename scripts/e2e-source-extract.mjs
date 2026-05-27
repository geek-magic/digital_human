import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:8083";
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const outDir = join(process.cwd(), "storage", "e2e-source-extract");
mkdirSync(outDir, { recursive: true });

const shareText = process.env.E2E_SOURCE_SHARE || "5.12 :9pm KWZ:/ 07/25 a@A.GI AI 剪辑教程：用这套方法，让Codex剪视频效果和效率翻倍 用 HyperFrames 生成或剪辑视频效果不好，这一期教你一招解决方法。 # AI新星计划 # AI # AI剪辑 # codex # skills  https://v.douyin.com/gInMOEMQ5cI/ 复制此链接，打开Dou音搜索，直接观看视频！";

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

  const seed = `链接解析端到端验证-${Date.now()}`;
  const composer = page.locator("form").first();
  await composer.getByRole("textbox", { name: "任务标题" }).fill(seed);
  await composer.getByPlaceholder("输入主题、需求、参考信息").fill(seed);
  await page.getByRole("button", { name: "创建手动任务" }).click();
  await page.waitForFunction((expected) => {
    return document.querySelector(".task-detail")?.textContent?.includes(expected);
  }, seed, { timeout: 30000 });
  const beforeState = await fetch(`${baseUrl}/api/state`).then((response) => response.json());
  const project = beforeState.projects.find((item) => item.inputText.includes(seed));
  assert(project, "没有找到刚创建的端到端验证任务。");

  await page.getByLabel("链接解析输入").fill(shareText);
  await page.screenshot({ path: join(outDir, "01-before-extract.png"), fullPage: true });
  await page.getByRole("button", { name: "提取" }).click();

  await page.waitForFunction(() => {
    const cards = Array.from(document.querySelectorAll(".source-step-card"));
    const finalCard = cards.find((card) => card.textContent?.includes("解析结果"));
    return cards.length >= 5
      && finalCard?.textContent?.includes("AI 剪辑教程")
      && !finalCard?.textContent?.includes(":9pm");
  }, null, { timeout: 180000 });
  const stepTexts = await page.locator(".source-step-card").allTextContents();
  await page.getByRole("button", { name: "一键添加" }).click();
  await page.waitForFunction((payload) => {
    return fetch(`${payload.baseUrl}/api/state`)
      .then((response) => response.json())
      .then((state) => {
        const project = state.projects.find((item) => item.id === payload.projectId);
        return project?.inputText?.includes(payload.seed) && project.inputText.includes("AI 剪辑教程");
      });
  }, { baseUrl, projectId: project.id, seed }, { timeout: 30000 });

  const afterState = await fetch(`${baseUrl}/api/state`).then((response) => response.json());
  const updatedProject = afterState.projects.find((item) => item.id === project.id);
  const textareaValue = updatedProject?.inputText || "";
  const navTexts = await page.locator(".step-nav .step-tab strong").allTextContents().catch(() => []);
  await page.screenshot({ path: join(outDir, "02-after-extract.png"), fullPage: true });

  assert(textareaValue.includes(seed), `输入内容丢失初始内容：${textareaValue}`);
  assert(textareaValue.includes("AI 剪辑教程"), `输入内容没有追加最终文本：${textareaValue}`);
  assert(!textareaValue.includes("https://v.douyin.com"), `一键添加不应追加链接：${textareaValue}`);
  assert(!textareaValue.includes("来源视频标题"), `一键添加不应追加来源包装：${textareaValue}`);
  assert(stepTexts.some((text) => text.includes("提取链接") && text.includes("https://v.douyin.com/gInMOEMQ5cI/")), "步骤中没有展示提取出的链接。");
  assert(stepTexts.some((text) => text.includes("识别类型") && text.includes("抖音")), "步骤中没有展示平台类型。");
  assert(stepTexts.some((text) => text.includes("提取/下载") && text.includes("AI 剪辑教程")), "步骤中没有展示提取/下载产物。");
  assert(stepTexts.some((text) => text.includes("ASR 转写")), "步骤中没有展示 ASR 阶段。");
  assert(stepTexts.some((text) => text.includes("解析结果") && text.includes("AI 剪辑教程")), "步骤中没有展示最终解析结果。");
  assert(!navTexts.some((item) => /来源|解析/.test(item)), `任务节点仍包含来源解析：${navTexts.join(" / ")}`);
  assert(errors.length === 0, `Console/page errors found:\n${errors.join("\n")}`);

  console.log(JSON.stringify({ ok: true, finalInputText: textareaValue, steps: stepTexts, screenshots: outDir }, null, 2));
  await browser.close();
} catch (error) {
  await browser.close().catch(() => undefined);
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
}
