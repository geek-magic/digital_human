#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const modelHome = process.env.MODEL_HOME || join(rootDir, "models");
const targetDir = process.env.LATENTSYNC_HOME || join(modelHome, "avatar", "latentsync");
const tmpDir = join(rootDir, "storage", "model-downloads", `latentsync-${Date.now()}`);
const repoUrl = "https://github.com/bytedance/LatentSync.git";
const weightsBaseUrl = "https://huggingface.co/ByteDance/LatentSync-1.6/resolve/main";

function run(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: "inherit",
    timeout: 1000 * 60 * 90,
    ...options
  });
}

function commandExists(command) {
  try {
    execFileSync("which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function ensureRepo() {
  mkdirSync(dirname(targetDir), { recursive: true });
  if (existsSync(join(targetDir, "scripts", "inference.py"))) return;
  mkdirSync(tmpDir, { recursive: true });
  const repoTmp = join(tmpDir, "repo");
  run("git", ["clone", "--depth", "1", repoUrl, repoTmp]);
  mkdirSync(targetDir, { recursive: true });
  cpSync(repoTmp, targetDir, { recursive: true, force: false, errorOnExist: false });
}

function fileSizeReady(outputPath, minBytes) {
  if (!existsSync(outputPath)) return false;
  const size = Number(statSync(outputPath).size || 0);
  return size >= minBytes;
}

function cleanupAria2State(outputPath) {
  const aria2Path = `${outputPath}.aria2`;
  if (existsSync(aria2Path)) {
    rmSync(aria2Path, { force: true });
  }
}

function installedFileReady(outputPath, minBytes) {
  if (!fileSizeReady(outputPath, minBytes)) return false;
  cleanupAria2State(outputPath);
  return true;
}

function resolveDownloadUrl(url) {
  try {
    return execFileSync("curl", [
      "-sI",
      "-L",
      "--max-time",
      "30",
      "-o",
      "/dev/null",
      "-w",
      "%{url_effective}",
      "-A",
      "Mozilla/5.0",
      url
    ], { encoding: "utf-8" }).trim() || url;
  } catch {
    return url;
  }
}

function tryHuggingFaceDownload(hubFile, localDir, outputPath, minBytes) {
  if (!hubFile || process.env.LATENTSYNC_USE_HF_HUB === "0") return false;
  const attempts = Number(process.env.LATENTSYNC_HF_RETRIES || 12);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      run(pythonBin(), [
        "-m",
        "huggingface_hub.cli.hf",
        "download",
        "ByteDance/LatentSync-1.6",
        hubFile,
        "--local-dir",
        localDir,
        "--quiet",
        "--max-workers",
        process.env.LATENTSYNC_HF_WORKERS || "4"
      ], {
        env: {
          ...process.env,
          HF_XET_HIGH_PERFORMANCE: process.env.HF_XET_HIGH_PERFORMANCE || "1"
        }
      });
      if (installedFileReady(outputPath, minBytes)) return true;
    } catch {
      if (attempt === attempts) return false;
    }
  }
  return false;
}

function pythonBin() {
  return process.env.LATENTSYNC_INSTALL_PYTHON || (process.platform === "win32" ? "python" : "python3");
}

function download(url, outputPath, minBytes, hubFile = "", hubLocalDir = dirname(outputPath)) {
  mkdirSync(dirname(outputPath), { recursive: true });
  if (installedFileReady(outputPath, minBytes)) return;
  if (tryHuggingFaceDownload(hubFile, hubLocalDir, outputPath, minBytes)) return;
  if (hubFile && minBytes > 500_000_000 && process.env.LATENTSYNC_ALLOW_CURL_LARGE !== "1") {
    throw new Error(`${hubFile} 下载未完成，请重新运行安装命令继续断点续传。`);
  }
  if ((process.env.LATENTSYNC_USE_ARIA2 === "1" || minBytes > 500_000_000) && commandExists("aria2c")) {
    try {
      run("aria2c", [
        "-c",
        "-x",
        process.env.LATENTSYNC_ARIA2_CONNECTIONS || "16",
        "-s",
        process.env.LATENTSYNC_ARIA2_SPLITS || "32",
        "-k",
        "1M",
        "--file-allocation=none",
        "--max-tries=5",
        "--retry-wait=3",
        "--connect-timeout=30",
        "--user-agent=Mozilla/5.0",
        "-d",
        dirname(outputPath),
        "-o",
        basename(outputPath),
        resolveDownloadUrl(url)
      ]);
      if (installedFileReady(outputPath, minBytes)) return;
    } catch {
      // Hugging Face redirects can fail TLS negotiation in aria2c on some macOS builds; curl resumes the same file reliably.
    }
  }
  run("curl", [
    "-L",
    "--fail",
    "--http1.1",
    "--retry",
    process.env.LATENTSYNC_CURL_RETRIES || "100",
    "--retry-all-errors",
    "--retry-delay",
    process.env.LATENTSYNC_CURL_RETRY_DELAY || "5",
    "--connect-timeout",
    "30",
    "--speed-time",
    "120",
    "--speed-limit",
    "1024",
    "-A",
    "Mozilla/5.0",
    "-C",
    "-",
    "-o",
    outputPath,
    url
  ]);
  if (fileSizeReady(outputPath, minBytes)) cleanupAria2State(outputPath);
}

function writeManifests() {
  const manifestPath = join(targetDir, "digital-human-adapter.json");
  const manifest = {
    protocolId: "digital-human.avatar.render",
    protocolVersion: "1.0",
    engine: "ByteDance LatentSync 1.6",
    codeSource: "https://github.com/bytedance/LatentSync",
    weightSource: "https://huggingface.co/ByteDance/LatentSync-1.6",
    codeLicense: "Apache-2.0",
    weightLicense: "openrail++"
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  writeFileSync(join(targetDir, "WEIGHTS_NOTICE.md"), [
    "# LatentSync 1.6 Weights Notice",
    "",
    "Code source: https://github.com/bytedance/LatentSync",
    "Model source: https://huggingface.co/ByteDance/LatentSync-1.6",
    "Code license: Apache-2.0",
    "Model weights license: openrail++",
    "",
    "Keep this notice, the upstream LICENSE, and the Hugging Face model card when redistributing this model package."
  ].join("\n"));
}

ensureRepo();
download(
  `${weightsBaseUrl}/latentsync_unet.pt?download=true`,
  join(targetDir, "checkpoints", "latentsync_unet.pt"),
  5_000_000_000,
  "latentsync_unet.pt",
  join(targetDir, "checkpoints")
);
download(
  `${weightsBaseUrl}/whisper/tiny.pt?download=true`,
  join(targetDir, "checkpoints", "whisper", "tiny.pt"),
  30 * 1000 * 1000,
  "whisper/tiny.pt",
  join(targetDir, "checkpoints")
);
download(
  `${weightsBaseUrl}/README.md?download=true`,
  join(targetDir, "HUGGINGFACE_MODEL_CARD.md"),
  100,
  "README.md",
  targetDir
);
writeManifests();

console.log(`LatentSync installed at ${targetDir}`);
