import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:8083";
const outDir = join(process.cwd(), "storage", "e2e-real");
const sourceUrl =
  process.env.E2E_SOURCE_URL || "https://upload.wikimedia.org/wikipedia/commons/2/23/The_Earth_is_Female_-_Vandana_Shiva.webm";
const sourcePage =
  process.env.E2E_SOURCE_PAGE || "https://commons.wikimedia.org/wiki/File:The_Earth_is_Female_-_Vandana_Shiva.webm";

mkdirSync(outDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `${path} failed`);
  return body;
}

async function download(url, filePath) {
  if (existsSync(filePath)) return filePath;
  await execFileAsync("curl", [
    "-L",
    "--retry",
    "3",
    "--connect-timeout",
    "20",
    "--max-time",
    "180",
    "-A",
    "Mozilla/5.0",
    "-o",
    filePath,
    url
  ], { maxBuffer: 1024 * 1024 });
  return filePath;
}

async function transcodeAvatar(inputPath, outputPath) {
  await execFileAsync("ffmpeg", [
    "-y",
    "-ss",
    "5",
    "-i",
    inputPath,
    "-t",
    "8",
    "-vf",
    "scale=720:-2,format=yuv420p",
    "-an",
    outputPath
  ], { maxBuffer: 1024 * 1024 * 8 });
  return outputPath;
}

async function extractReferenceVoice(inputPath, outputPath) {
  await execFileAsync("ffmpeg", [
    "-y",
    "-ss",
    "5",
    "-i",
    inputPath,
    "-t",
    "8",
    "-vn",
    "-ac",
    "1",
    "-ar",
    "24000",
    outputPath
  ], { maxBuffer: 1024 * 1024 * 8 });
  return outputPath;
}

async function uploadFile(endpoint, path, name) {
  const form = new FormData();
  const bytes = await import("node:fs/promises").then((fs) => fs.readFile(path));
  form.append("name", name);
  form.append("file", new Blob([bytes]), basename(path));
  const response = await fetch(`${baseUrl}${endpoint}`, { method: "POST", body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "upload file failed");
  return body;
}

async function videoDuration(path) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    path
  ]);
  return Number.parseFloat(stdout.trim()) || 0;
}

await requestJson("/api/health");

const sourceKey = basename(new URL(sourceUrl).pathname).replace(/[^\w.-]+/g, "-").replace(/\.(webm|mp4|mov|m4v)$/i, "");
const downloaded = await download(sourceUrl, join(outDir, `${sourceKey}.webm`));
const avatarPath = await transcodeAvatar(downloaded, join(outDir, `${sourceKey}-avatar.mp4`));
const voicePath = await extractReferenceVoice(downloaded, join(outDir, `${sourceKey}-voice.wav`));
const avatar = await uploadFile("/api/assets/avatar-videos", avatarPath, "公开测试数字人素材");
const voice = await uploadFile("/api/voices/reference-samples", voicePath, "公开测试音色");

const marker = `固定模型包端到端验证-${Date.now()}`;
const project = await requestJson("/api/projects", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    inputText: `${marker}\n参考素材：${sourceUrl}`,
    requirements: "生成一段面向产品评审的中文数字人口播，控制在一分钟内，语气专业直接。",
    reviewEnabled: false,
    manualScript: false,
    avatarAssetId: avatar.id,
    voiceId: voice.id,
    platforms: ["douyin", "xiaohongshu", "wechat"]
  })
});

const completed = await requestJson(`/api/projects/${project.id}/run-all`, { method: "POST" });
assert(completed.artifacts?.video?.path, "missing video artifact");

const videoPath = resolve(completed.artifacts.video.path);
assert(existsSync(videoPath), `video not found: ${videoPath}`);
const duration = await videoDuration(videoPath);
assert(duration >= 5, `video too short: ${duration}`);

console.log(JSON.stringify({
  ok: true,
  projectId: completed.id,
  title: completed.title,
  videoPath,
  videoUri: completed.artifacts.video.uri,
  duration,
  sourcePage
}, null, 2));
