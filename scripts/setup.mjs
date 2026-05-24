#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipNpm = args.includes("--skip-npm");
const installerArgs = args.filter((arg) => arg !== "--dry-run" && arg !== "--skip-npm");

function bin(command) {
  return process.platform === "win32" ? `${command}.cmd` : command;
}

function run(command, commandArgs) {
  console.log(`\n> ${command} ${commandArgs.join(" ")}`);
  if (dryRun) return;
  execFileSync(command, commandArgs, {
    cwd: rootDir,
    stdio: "inherit",
    timeout: 1000 * 60 * 180,
    env: process.env
  });
}

function main() {
  console.log("开始一键安装数字人工厂依赖。");
  console.log("安装内容：Node 依赖、系统工具检查、Playwright Chromium、yt-dlp、本地模型和 MuseTalk 权重。");

  if (!skipNpm) {
    run(bin("npm"), ["install"]);
  }
  run(process.execPath, [join(rootDir, "scripts", "install-models.mjs"), ...installerArgs]);

  if (dryRun) {
    console.log("\n dry-run 完成，未执行实际安装。");
    return;
  }
  console.log("\n安装完成。启动服务可执行：npm run dev");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
