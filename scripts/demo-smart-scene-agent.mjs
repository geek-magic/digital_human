#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright";

const execFileAsync = promisify(execFile);
const rootDir = fileURLToPath(new URL("..", import.meta.url));
const db = JSON.parse(readFileSync(join(rootDir, "storage", "db.json"), "utf8"));
const outDir = join(rootDir, "storage", "artifacts", "smart-scene-agent-demo");
const workspaceDir = join(outDir, "workspace");
const framesDir = join(outDir, "frames");
const width = 720;
const height = 1280;
const fps = 24;
const projectId = process.env.DEMO_PROJECT_ID || "project-cf948e17-d065-42a5-9271-88cb7189592d";
const project = db.projects.find((item) => item.id === projectId);
if (!project) throw new Error(`Project not found: ${projectId}`);
const provider = db.apiProviders?.find((item) => item.providerId === "deepseek" || item.id === "provider-deepseek");
if (!provider?.apiKey) throw new Error("DeepSeek provider is not configured.");

const audio = project.audioVersions?.[0];
const audioPath = audio?.audioPath || audio?.path || project.artifacts?.audio?.path;
const presenterPath = project.videoVersions?.[0]?.videoPath || project.artifacts?.video?.path;
const scriptText = project.artifacts?.script?.script || project.inputText || "";
const duration = Math.min(32, Math.max(8, Math.ceil(Number(audio?.duration || project.artifacts?.audio?.duration || 24))));

function jsonFromText(text = "") {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return JSON.parse(fenced[1].trim());
    return JSON.parse(trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1));
  }
}

function cleanFiles(payload) {
  const allowed = new Set(["index.html", "style.css", "main.js"]);
  const files = (payload.files || []).filter((file) => allowed.has(file.path) && String(file.content || "").trim());
  if (!files.some((file) => file.path === "index.html")) throw new Error("Agent did not write index.html.");
  return files;
}

async function callDeepSeek(messages, temperature = 0.35) {
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify({
      model: process.env.DEMO_DEEPSEEK_MODEL || provider.model || "deepseek-chat",
      messages,
      temperature,
      max_tokens: 6000
    }),
    signal: AbortSignal.timeout(180000)
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`DeepSeek HTTP ${response.status}: ${raw.slice(0, 240)}`);
  const data = JSON.parse(raw);
  return data.choices?.[0]?.message?.content || "";
}

function agentSystemPrompt() {
  return [
    "你是一个 HyperFrames 视频代码智能体，负责写 720x1280 竖屏 HTML/CSS/JS 动画工程。",
    "你只能输出 JSON，不要 Markdown。JSON 结构：{\"files\":[{\"path\":\"index.html\",\"content\":\"...\"}],\"notes\":\"...\"}",
    "只生成一个自包含 index.html，CSS 和 JS 都内联在 HTML 里。",
    "必须实现 window.setFrameTime(t)，t 是秒，渲染器会逐帧调用。",
    "不要引用外网，不要 fetch，不要 import，不要 eval。",
    "右下角必须预留 260x350 数字人画中画区域，任何主标题、卖点卡、CTA 都不要进入右下角。",
    "字幕由平台最外层统一烧录，你不要在右下角数字人小窗里放字幕。",
    "画面要适合宣传：有餐饮烟火气、柴火鸡、聚餐、卖点拆解、进度条、动态卡片。"
  ].join("\n");
}

function agentUserPrompt() {
  return [
    `任务标题：${project.title}`,
    `视频时长：${duration}秒`,
    `口播内容：${scriptText}`,
    "业务要求：生成餐饮探店/商品讲解风格的智能布景主画面。主画面要展示柴火鸡卖点、传统柴火烹饪、聚餐场景、香料和烟火气。右下角放数字人口播画中画，所以右下角避让。",
    "请直接写可以运行的单文件 index.html。字体不要过大到溢出；中文要能显示；必须有清晰分镜切换；代码尽量简洁。"
  ].join("\n");
}

async function generateFiles(previous = null, error = "") {
  const messages = [
    { role: "system", content: agentSystemPrompt() },
    { role: "user", content: agentUserPrompt() }
  ];
  if (previous && error) {
    messages.push({
      role: "user",
      content: `上一次代码运行失败：${error}\n请修复并重新输出完整 files JSON。\n${previous.files.map((file) => `--- ${file.path} ---\n${file.content}`).join("\n\n")}`
    });
  }
  const text = await callDeepSeek(messages, previous ? 0.2 : 0.35);
  const payload = jsonFromText(text);
  return { files: cleanFiles(payload), notes: payload.notes || "", raw: text };
}

function writeFiles(files) {
  mkdirSync(workspaceDir, { recursive: true });
  for (const file of files) writeFileSync(join(workspaceDir, file.path), file.content);
}

async function renderVideo(htmlPath, outPath, seconds) {
  mkdirSync(framesDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto(`file://${htmlPath}`);
    const ok = await page.evaluate(() => typeof window.setFrameTime === "function");
    if (!ok) throw new Error("window.setFrameTime(t) is missing.");
    const total = Math.round(seconds * fps);
    for (let frame = 0; frame < total; frame += 1) {
      await page.evaluate((t) => window.setFrameTime(t), frame / fps);
      await page.screenshot({ path: join(framesDir, `${String(frame + 1).padStart(5, "0")}.png`), type: "png" });
      if (frame % 120 === 0) process.stdout.write(`frame ${frame}/${total}\n`);
    }
  } finally {
    await browser.close();
  }
  await execFileAsync("ffmpeg", [
    "-y",
    "-framerate", String(fps),
    "-i", join(framesDir, "%05d.png"),
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-crf", "18",
    "-movflags", "+faststart",
    outPath
  ], { timeout: 1200000, maxBuffer: 1024 * 1024 * 16 });
}

function srtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function splitCaptions(text) {
  const parts = String(text || "").split(/(?<=[。！？!?])/).map((item) => item.trim()).filter(Boolean);
  return parts.length ? parts : [text.slice(0, 36)];
}

function buildSrt(text, seconds) {
  const parts = splitCaptions(text).slice(0, 10);
  const segment = seconds / parts.length;
  return parts.map((part, index) => {
    const start = index * segment;
    const end = index === parts.length - 1 ? seconds : (index + 1) * segment;
    return `${index + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${part}\n`;
  }).join("\n");
}

function escapeFilterPath(filePath) {
  return filePath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

async function compose(mainPath, outPath, srtPath) {
  if (!existsSync(audioPath)) throw new Error(`Audio not found: ${audioPath}`);
  if (!existsSync(presenterPath)) throw new Error(`Presenter video not found: ${presenterPath}`);
  await execFileAsync("ffmpeg", [
    "-y",
    "-i", mainPath,
    "-stream_loop", "-1",
    "-i", presenterPath,
    "-i", audioPath,
    "-filter_complex",
    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[base];` +
      `[1:v]scale=220:-1,crop=220:310:(iw-220)/2:40,setsar=1[pip];` +
      `[base][pip]overlay=W-w-28:H-h-28,drawbox=x=iw-220-28:y=ih-310-28:w=220:h=310:color=white@0.85:t=3,` +
      `subtitles=filename='${escapeFilterPath(srtPath)}':force_style='Fontsize=20,MarginV=90,PrimaryColour=&H00FFFFFF&,OutlineColour=&HAA000000&,BorderStyle=1,Outline=2'[v]`,
    "-map", "[v]",
    "-map", "2:a:0",
    "-t", String(duration),
    "-shortest",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-crf", "18",
    "-c:a", "aac",
    "-movflags", "+faststart",
    outPath
  ], { timeout: 1200000, maxBuffer: 1024 * 1024 * 16 });
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  let agent;
  try {
    agent = await generateFiles();
    writeFiles(agent.files);
    await renderVideo(join(workspaceDir, "index.html"), join(outDir, "preview.mp4"), Math.min(3, duration));
  } catch (error) {
    agent = await generateFiles(agent, error instanceof Error ? error.message : String(error));
    writeFiles(agent.files);
  }
  writeFileSync(join(outDir, "agent-output.json"), JSON.stringify(agent, null, 2));
  const mainPath = join(outDir, "smart-scene-main.mp4");
  const finalPath = join(outDir, "smart-scene-agent-with-audio.mp4");
  const srtPath = join(outDir, "captions.srt");
  writeFileSync(srtPath, buildSrt(scriptText, duration));
  await renderVideo(join(workspaceDir, "index.html"), mainPath, duration);
  await compose(mainPath, finalPath, srtPath);
  process.stdout.write(JSON.stringify({ ok: true, finalPath, mainPath, srtPath, workspaceDir, duration }, null, 2) + "\n");
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
