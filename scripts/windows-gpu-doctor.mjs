#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const museTalkHome = process.env.MUSETALK_HOME || join(rootDir, "models", "avatar", "MuseTalk");
const museTalkPython = process.env.MUSETALK_PYTHON || (process.platform === "win32"
  ? join(museTalkHome, ".venv", "Scripts", "python.exe")
  : join(museTalkHome, ".venv", "bin", "python"));

function run(command, args = []) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    return error?.stderr?.toString?.().trim() || error?.message || String(error);
  }
}

function commandExists(command) {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const payload = {
  platform: process.platform,
  arch: process.arch,
  nvidiaSmiFound: commandExists("nvidia-smi"),
  nvidiaSmi: commandExists("nvidia-smi") ? run("nvidia-smi", ["--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"]) : "",
  museTalkPython,
  museTalkPythonExists: existsSync(museTalkPython),
  torch: null
};

if (existsSync(museTalkPython)) {
  const script = [
    "import json, torch",
    "print(json.dumps({",
    "  'version': torch.__version__,",
    "  'cuda_available': torch.cuda.is_available(),",
    "  'cuda_version': getattr(torch.version, 'cuda', None),",
    "  'device_count': torch.cuda.device_count() if torch.cuda.is_available() else 0,",
    "  'device_name': torch.cuda.get_device_name(0) if torch.cuda.is_available() else '',",
    "  'mps_available': bool(getattr(torch.backends, 'mps', None) and torch.backends.mps.is_available())",
    "}, ensure_ascii=False))"
  ].join("\n");
  try {
    payload.torch = JSON.parse(run(museTalkPython, ["-c", script]) || "{}");
  } catch (error) {
    payload.torch = { error: error instanceof Error ? error.message : String(error) };
  }
}

const ok = process.platform === "win32"
  ? Boolean(payload.nvidiaSmiFound && payload.torch?.cuda_available)
  : Boolean(payload.torch?.cuda_available || payload.torch?.mps_available);

console.log(JSON.stringify({ ok, ...payload }, null, 2));
if (!ok) process.exitCode = 1;
