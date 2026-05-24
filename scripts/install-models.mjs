#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const modelHome = process.env.MODEL_HOME || join(rootDir, "models");
const runtimeHome = process.env.DH_RUNTIME_HOME || join(rootDir, "runtime");
const python = process.env.DH_INSTALL_PYTHON || (process.platform === "win32" ? "python" : "python3");
const hfEndpoint = process.env.HF_ENDPOINT || "";

const models = {
  llm: {
    repo: "mlx-community/Qwen3.5-27B-4bit",
    target: join(modelHome, "llm", "qwen3.5-27b-4bit-mlx"),
    runtime: join(runtimeHome, "llm"),
    packages: ["mlx-lm", "huggingface_hub[cli]"],
    required: ["config.json", "tokenizer.json", "model.safetensors.index.json"],
    protocol: {
      protocolId: "digital-human.llm.script",
      protocolVersion: "1.0",
      engine: "Qwen3.5-27B 4bit MLX",
      weightSource: "https://huggingface.co/mlx-community/Qwen3.5-27B-4bit",
      license: "Apache-2.0"
    }
  },
  asr: {
    repo: "Qwen/Qwen3-ASR-1.7B",
    target: join(modelHome, "asr", "qwen3-asr-1.7b"),
    runtime: join(runtimeHome, "asr"),
    packages: ["qwen-asr", "huggingface_hub[cli]"],
    required: ["config.json", "preprocessor_config.json", "model.safetensors.index.json"],
    protocol: {
      protocolId: "digital-human.asr.transcript",
      protocolVersion: "1.0",
      engine: "Qwen3-ASR 1.7B",
      weightSource: "https://huggingface.co/Qwen/Qwen3-ASR-1.7B",
      license: "Apache-2.0"
    }
  },
  tts: {
    repo: "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    target: join(modelHome, "tts", "qwen3-tts-12hz-1.7b-base"),
    runtime: join(runtimeHome, "tts"),
    packages: ["qwen-tts", "soundfile", "huggingface_hub[cli]"],
    required: ["config.json", "model.safetensors", "speech_tokenizer/model.safetensors"],
    protocol: {
      protocolId: "digital-human.tts.voice",
      protocolVersion: "1.0",
      engine: "Qwen3-TTS 12Hz 1.7B Base",
      weightSource: "https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base",
      license: "Apache-2.0"
    }
  }
};

const museTalkRequired = [
  "scripts/inference.py",
  "models/musetalkV15/unet.pth",
  "models/musetalkV15/musetalk.json",
  "models/sd-vae/config.json",
  "models/sd-vae/diffusion_pytorch_model.bin",
  "models/whisper/config.json",
  "models/whisper/pytorch_model.bin",
  "models/whisper/preprocessor_config.json",
  "models/face-parse-bisent/79999_iter.pth",
  "models/face-parse-bisent/resnet18-5c106cde.pth"
];

const museTalk = {
  repo: "https://github.com/TMElyralab/MuseTalk.git",
  target: join(modelHome, "avatar", "MuseTalk"),
  protocol: {
    protocolId: "digital-human.avatar.render",
    protocolVersion: "1.0",
    engine: "MuseTalk v1.5",
    codeSource: "https://github.com/TMElyralab/MuseTalk",
    weightSource: "https://huggingface.co/TMElyralab/MuseTalk",
    license: "Apache-2.0"
  }
};

function run(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: "inherit",
    timeout: 1000 * 60 * 120,
    env: {
      ...process.env,
      ...(hfEndpoint ? { HF_ENDPOINT: hfEndpoint } : {})
    },
    ...options
  });
}

function commandExists(command) {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function pythonInVenv(venv) {
  return process.platform === "win32" ? join(venv, "Scripts", "python.exe") : join(venv, "bin", "python");
}

function ensureVenv(venv) {
  const bin = pythonInVenv(venv);
  if (!existsSync(bin)) run(python, ["-m", "venv", venv]);
  run(bin, ["-m", "pip", "install", "-U", "pip", "setuptools", "wheel"]);
  return bin;
}

function runtimeMarker(venv) {
  return join(venv, ".digital-human-runtime-ready");
}

function installPackages(venv, packages) {
  const existingBin = pythonInVenv(venv);
  if (existsSync(existingBin) && existsSync(runtimeMarker(venv))) return existingBin;
  const bin = ensureVenv(venv);
  run(bin, ["-m", "pip", "install", "-U", ...packages]);
  writeFileSync(runtimeMarker(venv), `${new Date().toISOString()}\n`);
  return bin;
}

function hfDownload(repo, target, includes = [], pythonBin = python) {
  mkdirSync(target, { recursive: true });
  const args = ["-m", "huggingface_hub.cli.hf", "download", repo, "--local-dir", target, "--local-dir-use-symlinks", "False"];
  if (includes.length) args.push("--include", ...includes);
  run(pythonBin, args);
}

function writeManifest(target, manifest) {
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, "digital-human-adapter.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function requiredFilesReady(target, files) {
  return files.every((file) => existsSync(join(target, file)));
}

function installCoreModel(model) {
  const pythonBin = installPackages(model.runtime, model.packages);
  if (!requiredFilesReady(model.target, model.required)) {
    hfDownload(model.repo, model.target, [], pythonBin);
  }
  writeManifest(model.target, model.protocol);
}

function ensureMuseTalkRepo() {
  mkdirSync(dirname(museTalk.target), { recursive: true });
  if (existsSync(join(museTalk.target, "scripts", "inference.py"))) return;
  const tmp = join(rootDir, "storage", "model-downloads", `musetalk-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
  const repoTmp = join(tmp, "repo");
  run("git", ["clone", "--depth", "1", museTalk.repo, repoTmp]);
  mkdirSync(museTalk.target, { recursive: true });
  cpSync(repoTmp, museTalk.target, { recursive: true, force: true });
  rmSync(tmp, { recursive: true, force: true });
}

function installMuseTalkRuntime() {
  const packages = ["huggingface_hub[cli]", "gdown", "mediapipe"];
  const req = join(museTalk.target, "requirements.txt");
  const venv = join(museTalk.target, ".venv");
  const existingBin = pythonInVenv(venv);
  if (existsSync(existingBin) && existsSync(runtimeMarker(venv))) return existingBin;
  const bin = ensureVenv(venv);
  run(bin, ["-m", "pip", "install", "-U", ...packages]);
  if (existsSync(req)) run(bin, ["-m", "pip", "install", "-r", req]);
  writeFileSync(runtimeMarker(venv), `${new Date().toISOString()}\n`);
  return bin;
}

function curlDownload(url, outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  run("curl", [
    "-L",
    "--fail",
    "--retry",
    "20",
    "--retry-all-errors",
    "--retry-delay",
    "5",
    "-C",
    "-",
    "-o",
    outputPath,
    url
  ]);
}

function downloadMuseTalkWeights(pythonBin) {
  if (requiredFilesReady(museTalk.target, museTalkRequired)) {
    writeManifest(museTalk.target, museTalk.protocol);
    return;
  }
  const checkpointDir = join(museTalk.target, "models");
  hfDownload("TMElyralab/MuseTalk", checkpointDir, [
    "musetalkV15/musetalk.json",
    "musetalkV15/unet.pth"
  ], pythonBin);
  hfDownload("stabilityai/sd-vae-ft-mse", join(checkpointDir, "sd-vae"), [
    "config.json",
    "diffusion_pytorch_model.bin"
  ], pythonBin);
  hfDownload("openai/whisper-tiny", join(checkpointDir, "whisper"), [
    "config.json",
    "pytorch_model.bin",
    "preprocessor_config.json"
  ], pythonBin);
  const faceParse = join(checkpointDir, "face-parse-bisent", "79999_iter.pth");
  if (!fileReady(faceParse, 100_000_000)) {
    run(pythonBin, ["-m", "gdown", "--id", "154JgKpzCPW82qINcVieuPH3fZ2e0P812", "-O", faceParse]);
  }
  const resnet = join(checkpointDir, "face-parse-bisent", "resnet18-5c106cde.pth");
  if (!fileReady(resnet, 40_000_000)) {
    curlDownload("https://download.pytorch.org/models/resnet18-5c106cde.pth", resnet);
  }
  writeManifest(museTalk.target, museTalk.protocol);
}

function fileReady(path, minBytes) {
  if (!existsSync(path)) return false;
  return Number(statSync(path).size || 0) >= minBytes;
}

function main() {
  if (!commandExists("git")) throw new Error("缺少 git，请先安装 git 后重试。");
  installCoreModel(models.llm);
  installCoreModel(models.asr);
  installCoreModel(models.tts);
  ensureMuseTalkRepo();
  const museTalkPython = installMuseTalkRuntime();
  downloadMuseTalkWeights(museTalkPython);
  console.log(`模型已安装到：${modelHome}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
