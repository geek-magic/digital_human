#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const modelHome = process.env.MODEL_HOME || join(rootDir, "models");
const latentSyncHome = process.env.LATENTSYNC_HOME || process.env.LATENTSYNC_REPO || join(modelHome, "avatar", "latentsync");
const localPython = process.platform === "win32"
  ? join(latentSyncHome, ".venv", "Scripts", "python.exe")
  : join(latentSyncHome, ".venv", "bin", "python");
const pythonBin = process.env.LATENTSYNC_PYTHON || (existsSync(localPython) ? localPython : (process.platform === "win32" ? "python" : "python3"));
const ffmpegBin = process.env.FFMPEG_BIN || "ffmpeg";

const REQUIRED_PROTOCOL = {
  protocolId: "digital-human.avatar.render",
  protocolVersion: "1.0"
};

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function assertFile(path, label) {
  if (!existsSync(path)) {
    throw new Error(`${label} 不存在：${path}`);
  }
}

function validateProtocol() {
  const manifestPath = ["digital-human-adapter.json", "adapter.protocol.json"]
    .map((name) => join(latentSyncHome, name))
    .find((path) => existsSync(path));
  if (!manifestPath) {
    throw new Error("LatentSync 模型包缺少协议清单 digital-human-adapter.json");
  }
  const manifest = readJson(manifestPath);
  const protocolId = manifest.protocolId || manifest.adapterProtocolId;
  const protocolVersion = manifest.protocolVersion || manifest.adapterProtocolVersion || manifest.version;
  if (protocolId !== REQUIRED_PROTOCOL.protocolId || protocolVersion !== REQUIRED_PROTOCOL.protocolVersion) {
    throw new Error(`LatentSync 协议不一致：需要 ${REQUIRED_PROTOCOL.protocolId}@${REQUIRED_PROTOCOL.protocolVersion}`);
  }
}

async function run(command, args, options = {}) {
  await execFileAsync(command, args, {
    timeout: Number(process.env.LATENTSYNC_TIMEOUT_MS || 1200000),
    maxBuffer: 1024 * 1024 * 16,
    ...options
  });
}

async function normalizeInputs(payload, workDir) {
  const duration = Math.min(120, Math.max(1, Number(payload.duration || 45)));
  const videoPath = resolve(payload.avatarPath);
  const audioPath = resolve(payload.audioPath);
  assertFile(videoPath, "数字人原视频");
  assertFile(audioPath, "口播音频");

  const preparedVideo = join(workDir, "latentsync-input.mp4");
  const preparedAudio = join(workDir, "latentsync-audio.wav");
  await run(ffmpegBin, [
    "-y",
    "-stream_loop",
    "-1",
    "-i",
    videoPath,
    "-t",
    String(duration),
    "-vf",
    "fps=25,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
    "-an",
    preparedVideo
  ]);
  await run(ffmpegBin, [
    "-y",
    "-i",
    audioPath,
    "-t",
    String(duration),
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    preparedAudio
  ]);
  return { preparedVideo, preparedAudio };
}

async function render(payloadPath, outPath) {
  assertFile(payloadPath, "Adapter 输入");
  assertFile(join(latentSyncHome, "scripts", "inference.py"), "LatentSync 推理脚本");
  assertFile(join(latentSyncHome, "configs", "unet", "stage2_512.yaml"), "LatentSync 512 配置");
  assertFile(join(latentSyncHome, "checkpoints", "latentsync_unet.pt"), "LatentSync 权重");
  assertFile(join(latentSyncHome, "checkpoints", "whisper", "tiny.pt"), "Whisper tiny 权重");
  validateProtocol();

  const payload = readJson(payloadPath);
  const outputPath = resolve(outPath);
  const workDir = dirname(outputPath);
  mkdirSync(workDir, { recursive: true });
  const { preparedVideo, preparedAudio } = await normalizeInputs(payload, workDir);
  const rawOutput = join(workDir, "latentsync-raw.mp4");
  const tempDir = join(workDir, "latentsync-temp");
  mkdirSync(tempDir, { recursive: true });

  const args = [
    "-m",
    "scripts.inference",
    "--unet_config_path",
    process.env.LATENTSYNC_UNET_CONFIG_PATH || "configs/unet/stage2_512.yaml",
    "--inference_ckpt_path",
    process.env.LATENTSYNC_CKPT_PATH || "checkpoints/latentsync_unet.pt",
    "--inference_steps",
    process.env.LATENTSYNC_INFERENCE_STEPS || "20",
    "--guidance_scale",
    process.env.LATENTSYNC_GUIDANCE_SCALE || "1.5",
    "--video_path",
    preparedVideo,
    "--audio_path",
    preparedAudio,
    "--video_out_path",
    rawOutput,
    "--temp_dir",
    tempDir,
    "--seed",
    process.env.LATENTSYNC_SEED || "1247"
  ];
  if (process.env.LATENTSYNC_ENABLE_DEEPCACHE !== "0") {
    args.push("--enable_deepcache");
  }
  await run(pythonBin, args, {
    cwd: latentSyncHome,
    env: {
      ...process.env,
      PYTHONPATH: [latentSyncHome, process.env.PYTHONPATH].filter(Boolean).join(process.platform === "win32" ? ";" : ":")
    }
  });
  assertFile(rawOutput, "LatentSync 输出视频");
  await run(ffmpegBin, [
    "-y",
    "-i",
    rawOutput,
    "-i",
    preparedAudio,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-shortest",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outputPath
  ]);
  assertFile(outputPath, "最终数字人视频");
}

const [payloadPath, outPath] = process.argv.slice(2);
if (!payloadPath || !outPath) {
  console.error("Usage: latentsync-adapter.mjs <payload.json> <output.mp4>");
  process.exit(2);
}

render(payloadPath, outPath).catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
