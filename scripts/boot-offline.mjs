#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(join(__dirname, ".."));
const storageDir = join(rootDir, "storage");
const uploadDir = join(storageDir, "uploads");
const artifactDir = join(storageDir, "artifacts");
const dbPath = join(storageDir, "db.json");
const bundledFfmpeg = join(rootDir, "node_modules", "ffmpeg-static", "ffmpeg");
const scriptBinDir = "bin";
const pythonExe = "python";
const ytDlpExe = "yt-dlp";

function rewriteUploadPath(value = "") {
  if (!value || typeof value !== "string") return value;
  const normalized = value.replaceAll("\\", "/");
  const marker = "/storage/uploads/";
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex < 0) return value;
  const relativeUploadPath = normalized.slice(markerIndex + marker.length).split("/").filter(Boolean);
  return join(uploadDir, ...relativeUploadPath);
}

function fixDbPaths() {
  if (!existsSync(dbPath)) return;
  const db = JSON.parse(readFileSync(dbPath, "utf-8"));
  for (const collection of ["avatarAssets", "voices", "musicAssets"]) {
    for (const item of db[collection] || []) {
      for (const key of ["path", "audioPath", "videoPath"]) {
        if (item[key]) item[key] = rewriteUploadPath(item[key]);
      }
      if (item.uri && item.path) {
        const rel = item.path.replaceAll("\\", "/").split("/storage/uploads/")[1] || basename(item.path);
        item.uri = `/storage/uploads/${rel}`;
      }
    }
  }
  db.projects = [];
  db.jobs = [];
  db.queueItems = [];
  db.sourceExtractions = [];
  db.publishPackages = [];
  db.publishRecords = [];
  writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`);
}

mkdirSync(uploadDir, { recursive: true });
mkdirSync(artifactDir, { recursive: true });
fixDbPaths();

const env = {
  ...process.env,
  MODEL_HOME: join(rootDir, "models"),
  DH_LLM_PYTHON: join(rootDir, "runtime", "llm", scriptBinDir, pythonExe),
  DH_ASR_PYTHON: join(rootDir, "runtime", "asr", scriptBinDir, pythonExe),
  DH_TTS_PYTHON: join(rootDir, "runtime", "tts", scriptBinDir, pythonExe),
  MUSETALK_HOME: join(rootDir, "models", "avatar", "MuseTalk"),
  MUSETALK_PYTHON: join(rootDir, "models", "avatar", "MuseTalk", ".venv", scriptBinDir, pythonExe),
  YT_DLP_BIN: join(rootDir, "runtime", "tools", scriptBinDir, ytDlpExe),
  FFMPEG_BIN: existsSync(bundledFfmpeg) ? bundledFfmpeg : (process.env.FFMPEG_BIN || "ffmpeg"),
  FFMPEG_H264_ENCODER: process.env.FFMPEG_H264_ENCODER || "h264_videotoolbox",
  MUSETALK_DEVICE: process.env.MUSETALK_DEVICE || "mps",
  MUSETALK_BATCH_SIZE: process.env.MUSETALK_BATCH_SIZE || "8",
  PYTORCH_ENABLE_MPS_FALLBACK: process.env.PYTORCH_ENABLE_MPS_FALLBACK || "1",
  PYTORCH_MPS_HIGH_WATERMARK_RATIO: process.env.PYTORCH_MPS_HIGH_WATERMARK_RATIO || "1.0",
  PYTORCH_MPS_LOW_WATERMARK_RATIO: process.env.PYTORCH_MPS_LOW_WATERMARK_RATIO || "0.7",
  PORT: process.env.PORT || "8083"
};

console.log(`口播智能体离线版启动中：http://127.0.0.1:${env.PORT}`);
const child = spawn(process.execPath, ["server/index.js"], {
  cwd: rootDir,
  env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
