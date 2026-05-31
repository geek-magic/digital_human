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

function rewriteUploadPath(value = "") {
  if (!value || typeof value !== "string") return value;
  if (!value.includes("/storage/uploads/") && !value.includes("\\storage\\uploads\\")) return value;
  return join(uploadDir, basename(value));
}

function fixDbPaths() {
  if (!existsSync(dbPath)) return;
  const db = JSON.parse(readFileSync(dbPath, "utf-8"));
  for (const collection of ["avatarAssets", "voices", "musicAssets"]) {
    for (const item of db[collection] || []) {
      for (const key of ["path", "audioPath", "videoPath"]) {
        if (item[key]) item[key] = rewriteUploadPath(item[key]);
      }
      if (item.uri && item.path) item.uri = `/storage/uploads/${basename(item.path)}`;
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
  DH_LLM_PYTHON: join(rootDir, "runtime", "llm", "bin", "python"),
  DH_ASR_PYTHON: join(rootDir, "runtime", "asr", "bin", "python"),
  DH_TTS_PYTHON: join(rootDir, "runtime", "tts", "bin", "python"),
  MUSETALK_HOME: join(rootDir, "models", "avatar", "MuseTalk"),
  MUSETALK_PYTHON: join(rootDir, "models", "avatar", "MuseTalk", ".venv", "bin", "python"),
  YT_DLP_BIN: join(rootDir, "runtime", "tools", "bin", "yt-dlp"),
  FFMPEG_BIN: existsSync(bundledFfmpeg) ? bundledFfmpeg : (process.env.FFMPEG_BIN || "ffmpeg"),
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
