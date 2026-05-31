#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync, chmodSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(join(__dirname, ".."));
const outRoot = resolve(process.argv[2] || join(rootDir, "dist-packages"));
const packageName = "digital-human-mac-arm64";
const packageDir = join(outRoot, packageName);

function run(command, args, options = {}) {
  console.log(`> ${command} ${args.join(" ")}`);
  execFileSync(command, args, { cwd: rootDir, stdio: "inherit", timeout: 1000 * 60 * 120, ...options });
}

function ensureCleanDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function copyRsync(source, target, extra = []) {
  if (!existsSync(source)) throw new Error(`缺少打包源：${source}`);
  mkdirSync(dirname(target), { recursive: true });
  run("rsync", ["-aL", "--delete", ...extra, `${source.replace(/\/$/, "")}/`, `${target.replace(/\/$/, "")}/`]);
}

function copyFile(source, target) {
  if (!existsSync(source)) throw new Error(`缺少打包源：${source}`);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

function cleanDbForPackage() {
  const db = JSON.parse(readFileSync(join(rootDir, "storage", "db.json"), "utf-8"));
  const keepUploadNames = new Set();
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
  db.settings.defaultTextModelId = "model-qwen2-5-7b-instruct-4bit-mlx";
  db.settings.defaultModelIds ||= {};
  db.settings.defaultModelIds.llm = "model-qwen2-5-7b-instruct-4bit-mlx";
  db.settings.defaultModelIds.tts = "model-voxcpm2";
  db.settings.defaultModelIds.avatar = "model-musetalk-v15";
  db.settings.defaultModelIds.asr = "model-qwen3-asr-1-7b";
  return { db, keepUploadNames };
}

function writeStartScripts() {
  const startCommand = [
    "#!/bin/zsh",
    "cd \"$(dirname \"$0\")\"",
    "export PORT=${PORT:-8083}",
    "echo \"启动口播智能体：http://127.0.0.1:${PORT}\"",
    "NODE_BIN=\"./runtime/node/bin/node\"",
    "if [ ! -x \"$NODE_BIN\" ]; then NODE_BIN=\"$(command -v node)\"; fi",
    "if [ -z \"$NODE_BIN\" ]; then echo \"未找到 Node 运行时，请重新获取完整离线包。\"; exit 1; fi",
    "\"$NODE_BIN\" scripts/boot-offline.mjs"
  ].join("\n");
  const startPath = join(packageDir, "start.command");
  writeFileSync(startPath, `${startCommand}\n`);
  chmodSync(startPath, 0o755);

  writeFileSync(join(packageDir, "README-离线启动.txt"), [
    "口播智能体 mac-arm64 离线包",
    "",
    "启动方式：",
    "1. 双击 start.command",
    "2. 浏览器打开 http://127.0.0.1:8083",
    "",
    "如果 macOS 提示安全限制，可在终端执行：",
    "chmod +x start.command",
    "xattr -dr com.apple.quarantine .",
    "",
    "本包不包含历史任务和生成产物，只包含默认素材、音色、背景音、模型和运行环境。"
  ].join("\n"));
}

function main() {
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error("当前脚本只用于生成 mac-arm64 离线包。");
  }

  console.log(`输出目录：${packageDir}`);
  run("npm", ["run", "build"]);
  ensureCleanDir(packageDir);

  for (const file of ["package.json", "package-lock.json", "README.md", "index.html", "tsconfig.json", "vite.config.ts"]) {
    copyFile(join(rootDir, file), join(packageDir, file));
  }
  for (const dir of ["dist", "server", "scripts", "node_modules"]) {
    copyRsync(join(rootDir, dir), join(packageDir, dir), dir === "node_modules" ? ["--exclude", ".cache"] : []);
  }

  copyRsync(join(rootDir, "models", "llm", "qwen2.5-7b-instruct-4bit-mlx"), join(packageDir, "models", "llm", "qwen2.5-7b-instruct-4bit-mlx"), ["--exclude", ".cache"]);
  copyRsync(join(rootDir, "models", "asr", "qwen3-asr-1.7b"), join(packageDir, "models", "asr", "qwen3-asr-1.7b"), ["--exclude", ".cache"]);
  copyRsync(join(rootDir, "models", "tts", "voxcpm2"), join(packageDir, "models", "tts", "voxcpm2"), ["--exclude", ".cache"]);
  copyRsync(join(rootDir, "models", "avatar", "MuseTalk"), join(packageDir, "models", "avatar", "MuseTalk"), [
    "--exclude", ".git",
    "--exclude", "runs",
    "--exclude", "__pycache__",
    "--exclude", "*.pyc"
  ]);

  copyRsync(join(rootDir, "runtime", "llm"), join(packageDir, "runtime", "llm"), ["--exclude", "__pycache__", "--exclude", "*.pyc"]);
  copyRsync(join(rootDir, "runtime", "asr"), join(packageDir, "runtime", "asr"), ["--exclude", "__pycache__", "--exclude", "*.pyc"]);
  copyRsync(join(rootDir, "runtime", "tts"), join(packageDir, "runtime", "tts"), ["--exclude", "__pycache__", "--exclude", "*.pyc"]);
  copyRsync(join(rootDir, "runtime", "tools"), join(packageDir, "runtime", "tools"), ["--exclude", "__pycache__", "--exclude", "*.pyc"]);
  copyFile(process.execPath, join(packageDir, "runtime", "node", "bin", "node"));
  chmodSync(join(packageDir, "runtime", "node", "bin", "node"), 0o755);

  const { db, keepUploadNames } = cleanDbForPackage();
  mkdirSync(join(packageDir, "storage", "uploads"), { recursive: true });
  mkdirSync(join(packageDir, "storage", "artifacts"), { recursive: true });
  for (const name of keepUploadNames) {
    const source = join(rootDir, "storage", "uploads", name);
    if (existsSync(source)) copyFile(source, join(packageDir, "storage", "uploads", name));
  }
  writeFileSync(join(packageDir, "storage", "db.json"), `${JSON.stringify(db, null, 2)}\n`);
  writeStartScripts();

  console.log("\n离线包目录已生成：");
  run("du", ["-sh", packageDir], { cwd: outRoot });
  console.log(`\n下一步如需压缩：cd ${outRoot} && ditto -c -k --sequesterRsrc --keepParent ${packageName} ${packageName}.zip`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
