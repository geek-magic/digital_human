#!/usr/bin/env node
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(join(__dirname, ".."));
const outRoot = resolve(process.argv[2] || join(rootDir, "dist-packages"));
const packageName = "digital-human-win-x64";
const packageDir = join(outRoot, packageName);

function run(command, args, options = {}) {
  console.log(`> ${command} ${args.join(" ")}`);
  execFileSync(command, args, { cwd: rootDir, stdio: "inherit", timeout: 1000 * 60 * 120, ...options });
}

function ensureCleanDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function copyDir(source, target, options = {}) {
  if (!existsSync(source)) throw new Error(`缺少打包源：${source}`);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, {
    recursive: true,
    dereference: true,
    force: true,
    errorOnExist: false,
    filter: (src) => {
      const normalized = src.replaceAll("\\", "/");
      return !(options.exclude || []).some((pattern) => {
        if (pattern.startsWith("*")) return normalized.endsWith(pattern.slice(1));
        return normalized.split("/").includes(pattern);
      });
    }
  });
}

function copyFile(source, target) {
  if (!existsSync(source)) throw new Error(`缺少打包源：${source}`);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

function cleanDbForPackage() {
  const db = JSON.parse(readFileSync(join(rootDir, "storage", "db.json"), "utf-8"));
  db.avatarAssets = [];
  db.voices = [];
  db.musicAssets = [];
  db.projects = [];
  db.jobs = [];
  db.queueItems = [];
  db.sourceExtractions = [];
  db.publishPackages = [];
  db.publishRecords = [];
  db.runtimeModels = {};
  db.apiProviders = [];
  db.apiProviderCatalog = [];
  db.settings ||= {};
  db.settings.defaultTextModelId = "model-qwen2-5-7b-instruct-q4-k-m-gguf";
  db.settings.defaultModelIds ||= {};
  db.settings.defaultModelIds.llm = "model-qwen2-5-7b-instruct-q4-k-m-gguf";
  db.settings.defaultModelIds.tts = "model-voxcpm2";
  db.settings.defaultModelIds.avatar = "model-musetalk-v15";
  db.settings.defaultModelIds.asr = "model-qwen3-asr-1-7b";
  db.settings.defaultAvatarAssetId = "";
  db.settings.defaultVoiceId = "";
  db.settings.defaultVolcengineSpeakerId = "";
  db.settings.objectStorage = {
    provider: "aliyun-oss",
    enabled: false,
    accessKeyId: "",
    accessKeySecret: "",
    bucket: "",
    region: "",
    endpoint: "",
    pathPrefix: "digital-human-temp",
    expiresSeconds: 600
  };
  db.settings.ttsSegmentMaxChars = 180;
  return db;
}

function writeStartScripts() {
  const startBat = [
    "@echo off",
    "cd /d %~dp0",
    "set PORT=%PORT%",
    "if \"%PORT%\"==\"\" set PORT=8083",
    "echo 启动口播智能体：http://127.0.0.1:%PORT%",
    "set NODE_BIN=%~dp0runtime\\node\\node.exe",
    "if not exist \"%NODE_BIN%\" set NODE_BIN=node",
    "\"%NODE_BIN%\" scripts\\boot-offline.mjs",
    "pause"
  ].join("\r\n");
  writeFileSync(join(packageDir, "start.bat"), `${startBat}\r\n`);

  const startPs1 = [
    "$ErrorActionPreference = \"Stop\"",
    "Set-Location $PSScriptRoot",
    "if (-not $env:PORT) { $env:PORT = \"8083\" }",
    "Write-Host \"启动口播智能体：http://127.0.0.1:$env:PORT\"",
    "$node = Join-Path $PSScriptRoot \"runtime/node/node.exe\"",
    "if (-not (Test-Path $node)) { $node = \"node\" }",
    "& $node \"scripts/boot-offline.mjs\""
  ].join("\r\n");
  writeFileSync(join(packageDir, "start.ps1"), `${startPs1}\r\n`);

  writeFileSync(join(packageDir, "README-离线启动.txt"), [
    "口播智能体 Windows x64 离线包",
    "",
    "启动方式：",
    "1. 双击 start.bat",
    "2. 浏览器打开 http://127.0.0.1:8083",
    "",
    "要求：",
    "- Windows 10/11 x64",
    "- NVIDIA 显卡和可用驱动。MuseTalk 在 Windows 上应使用 CUDA，否则会非常慢。",
    "- 如果 PowerShell 安全策略拦截 start.ps1，直接双击 start.bat。",
    "",
    "本包不包含历史任务、素材、音色、背景音、发布记录和云端 API Key。"
  ].join("\r\n"));
}

function main() {
  if (process.platform !== "win32" || process.arch !== "x64") {
    throw new Error("当前脚本只能在 Windows x64 机器上生成 Windows 离线包。");
  }

  console.log(`输出目录：${packageDir}`);
  run("npm.cmd", ["run", "build"]);
  ensureCleanDir(packageDir);

  for (const file of ["package.json", "package-lock.json", "README.md", "index.html", "tsconfig.json", "vite.config.ts"]) {
    copyFile(join(rootDir, file), join(packageDir, file));
  }
  for (const dir of ["dist", "server", "scripts", "node_modules"]) {
    copyDir(join(rootDir, dir), join(packageDir, dir), dir === "node_modules" ? { exclude: [".cache"] } : {});
  }

  copyDir(
    join(rootDir, "models", "llm", "qwen2.5-7b-instruct-q4-k-m-gguf"),
    join(packageDir, "models", "llm", "qwen2.5-7b-instruct-q4-k-m-gguf"),
    { exclude: [".cache"] }
  );
  copyDir(join(rootDir, "models", "asr", "qwen3-asr-1.7b"), join(packageDir, "models", "asr", "qwen3-asr-1.7b"), { exclude: [".cache"] });
  copyDir(join(rootDir, "models", "tts", "voxcpm2"), join(packageDir, "models", "tts", "voxcpm2"), { exclude: [".cache"] });
  copyDir(join(rootDir, "models", "avatar", "MuseTalk"), join(packageDir, "models", "avatar", "MuseTalk"), {
    exclude: [".git", "runs", "__pycache__", "*.pyc"]
  });

  copyDir(join(rootDir, "runtime", "llama.cpp"), join(packageDir, "runtime", "llama.cpp"));
  copyDir(join(rootDir, "runtime", "asr"), join(packageDir, "runtime", "asr"), { exclude: ["__pycache__", "*.pyc"] });
  copyDir(join(rootDir, "runtime", "tts"), join(packageDir, "runtime", "tts"), { exclude: ["__pycache__", "*.pyc"] });
  copyDir(join(rootDir, "runtime", "tools"), join(packageDir, "runtime", "tools"), { exclude: ["__pycache__", "*.pyc"] });
  copyFile(process.execPath, join(packageDir, "runtime", "node", "node.exe"));

  mkdirSync(join(packageDir, "storage", "uploads"), { recursive: true });
  mkdirSync(join(packageDir, "storage", "artifacts"), { recursive: true });
  writeFileSync(join(packageDir, "storage", "db.json"), `${JSON.stringify(cleanDbForPackage(), null, 2)}\n`);
  writeStartScripts();

  console.log("\nWindows 离线包目录已生成：");
  run("powershell.exe", ["-NoProfile", "-Command", `(Get-ChildItem -Recurse -Force '${packageDir.replaceAll("'", "''")}' | Measure-Object -Property Length -Sum).Sum / 1GB`], { cwd: outRoot });
  console.log(`\n下一步如需压缩：Compress-Archive -Path "${packageDir}" -DestinationPath "${join(outRoot, `${packageName}.zip`)}" -Force`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
