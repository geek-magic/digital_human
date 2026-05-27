#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const museTalkHome = process.env.MUSETALK_HOME || join(rootDir, "models", "avatar", "MuseTalk");
const localPython = process.platform === "win32"
  ? join(museTalkHome, ".venv", "Scripts", "python.exe")
  : join(museTalkHome, ".venv", "bin", "python");
const pythonBin = process.env.MUSETALK_PYTHON || (existsSync(localPython) ? localPython : "python3");
const ffmpegBin = process.env.FFMPEG_BIN || "ffmpeg";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function assertFile(path, label) {
  if (!existsSync(path)) throw new Error(`${label} 不存在：${path}`);
}

function clampNumber(value, min, max, fallback, integer = false) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const clamped = Math.min(max, Math.max(min, parsed));
  return integer ? Math.round(clamped) : clamped;
}

function normalizeSettings(settings = {}) {
  return {
    cropMode: settings.cropMode === "default" ? "default" : "mediapipe",
    parsingMode: settings.parsingMode === "raw" ? "raw" : "jaw",
    upperBoundaryRatio: clampNumber(settings.upperBoundaryRatio, 0.35, 0.65, 0.5),
    extraMargin: clampNumber(settings.extraMargin, 0, 40, 0, true),
    facePad: clampNumber(settings.facePad, 0.04, 0.24, 0.12),
    lowerPad: clampNumber(settings.lowerPad, 0, 0.12, 0.03),
    batchSize: clampNumber(settings.batchSize, 1, 4, 1, true),
    leftCheekWidth: clampNumber(settings.leftCheekWidth, 40, 140, 90, true),
    rightCheekWidth: clampNumber(settings.rightCheekWidth, 40, 140, 90, true)
  };
}

async function run(command, args, options = {}) {
  return execFileAsync(command, args, {
    timeout: Number(process.env.MUSETALK_TIMEOUT_MS || 1200000),
    maxBuffer: 1024 * 1024 * 32,
    ...options
  });
}

function tailText(value = "", max = 6000) {
  const text = String(value || "");
  return text.length > max ? text.slice(-max) : text;
}

async function prepareInputs(payload, workDir) {
  const duration = Math.min(120, Math.max(1, Number(payload.duration || 45)));
  const sourceVideo = resolve(payload.avatarPath);
  const sourceAudio = resolve(payload.audioPath);
  assertFile(sourceVideo, "数字人原视频");
  assertFile(sourceAudio, "口播音频");

  const preparedVideo = join(workDir, "musetalk-input.mp4");
  const preparedAudio = join(workDir, "musetalk-audio.wav");
  await run(ffmpegBin, [
    "-y",
    "-stream_loop",
    "-1",
    "-i",
    sourceVideo,
    "-t",
    String(duration),
    "-vf",
    "fps=25,scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1,format=yuv420p",
    "-an",
    preparedVideo
  ]);
  await run(ffmpegBin, [
    "-y",
    "-i",
    sourceAudio,
    "-t",
    String(duration),
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    preparedAudio
  ]);
  return { preparedVideo, preparedAudio, duration };
}

async function createMediapipeCoords(videoPath, coordPath, settings) {
  const script = String.raw`
import cv2, json, pickle, sys
import mediapipe as mp
import numpy as np

video_path, coord_path, settings_json = sys.argv[1:4]
settings = json.loads(settings_json)
oval_idx = np.array([10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109])
cap = cv2.VideoCapture(video_path)
face_mesh = mp.solutions.face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)
coords = []
last = None
alpha = 0.72
while True:
    ok, frame = cap.read()
    if not ok:
        break
    h, w = frame.shape[:2]
    result = face_mesh.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    if not result.multi_face_landmarks:
        coords.append(last if last is not None else (0.0, 0.0, 0.0, 0.0))
        continue
    pts = np.array([(p.x * w, p.y * h) for p in result.multi_face_landmarks[0].landmark])
    oval = pts[oval_idx]
    left, right = oval[:, 0].min(), oval[:, 0].max()
    top, bottom = oval[:, 1].min(), oval[:, 1].max()
    face_w = right - left
    face_h = bottom - top
    half_y = pts[1, 1]
    upper = half_y - (bottom - half_y)
    pad_x = float(settings.get("facePad", 0.12)) * face_w
    pad_bottom = float(settings.get("lowerPad", 0.03)) * face_h
    box = np.array([
        max(0, left - pad_x),
        max(0, upper),
        min(w, right + pad_x),
        min(h, bottom + pad_bottom)
    ], dtype=np.float32)
    if last is not None:
        last_arr = np.array(last, dtype=np.float32)
        box = alpha * box + (1 - alpha) * last_arr
    box = tuple(int(round(v)) for v in box)
    if box[2] <= box[0] or box[3] <= box[1]:
        box = last if last is not None else (0.0, 0.0, 0.0, 0.0)
    coords.append(box)
    last = box
cap.release()
face_mesh.close()

def is_valid_box(item):
    try:
        x1, y1, x2, y2 = item
        return float(x2) > float(x1) and float(y2) > float(y1) and not (float(x1) == 0 and float(y1) == 0 and float(x2) == 0 and float(y2) == 0)
    except Exception:
        return False

detected_valid = sum(1 for item in coords if is_valid_box(item))
first_valid = next((item for item in coords if is_valid_box(item)), None)
if first_valid is not None:
    filled = []
    last_valid = first_valid
    for item in coords:
        if is_valid_box(item):
            last_valid = item
            filled.append(item)
        else:
            filled.append(last_valid)
    coords = filled
valid = sum(1 for item in coords if is_valid_box(item))
with open(coord_path, "wb") as f:
    pickle.dump(coords, f)
print(json.dumps({"frames": len(coords), "detectedValidFrames": detected_valid, "validFrames": valid, "coordPath": coord_path}))
`;
  const { stdout } = await run(pythonBin, ["-c", script, videoPath, coordPath, JSON.stringify(settings)], {
    cwd: museTalkHome,
    env: {
      ...process.env,
      PYTHONPATH: [museTalkHome, process.env.PYTHONPATH].filter(Boolean).join(process.platform === "win32" ? ";" : ":")
    }
  });
  const lines = String(stdout || "").trim().split(/\r?\n/).filter(Boolean);
  const result = JSON.parse(lines[lines.length - 1] || "{}");
  if (!result.validFrames) {
    throw new Error(`MediaPipe 未检测到有效人脸坐标。frames=${result.frames || 0}, validFrames=0`);
  }
  return result;
}

async function render(payloadPath, outPath) {
  assertFile(payloadPath, "Adapter 输入");
  assertFile(join(museTalkHome, "scripts", "inference.py"), "MuseTalk 推理脚本");
  assertFile(join(museTalkHome, "models", "musetalkV15", "unet.pth"), "MuseTalk v1.5 权重");
  assertFile(join(museTalkHome, "models", "sd-vae"), "MuseTalk VAE");
  assertFile(join(museTalkHome, "models", "whisper"), "MuseTalk Whisper");

  const payload = readJson(payloadPath);
  const settings = normalizeSettings(payload.videoSettings || {});
  const outputPath = resolve(outPath);
  const workDir = dirname(outputPath);
  mkdirSync(workDir, { recursive: true });
  const { preparedVideo, preparedAudio } = await prepareInputs(payload, workDir);

  const resultDir = join(workDir, "musetalk-result");
  mkdirSync(resultDir, { recursive: true });
  const resultName = "musetalk-output.mp4";
  const configPath = join(workDir, "musetalk-inference.yaml");
  writeFileSync(configPath, [
    "task_0:",
    ` video_path: "${preparedVideo.replace(/"/g, '\\"')}"`,
    ` audio_path: "${preparedAudio.replace(/"/g, '\\"')}"`,
    ` result_name: "${resultName}"`
  ].join("\n"));

  const args = [
    "-m",
    "scripts.inference",
    "--inference_config",
    configPath,
    "--result_dir",
    resultDir,
    "--unet_model_path",
    "./models/musetalkV15/unet.pth",
    "--unet_config",
    "./models/musetalkV15/musetalk.json",
    "--vae_type",
    "sd-vae",
    "--version",
    "v15",
    "--batch_size",
    String(settings.batchSize),
    "--extra_margin",
    String(settings.extraMargin),
    "--parsing_mode",
    settings.parsingMode,
    "--upper_boundary_ratio",
    String(settings.upperBoundaryRatio),
    "--left_cheek_width",
    String(settings.leftCheekWidth),
    "--right_cheek_width",
    String(settings.rightCheekWidth),
    "--saved_coord"
  ];

  if (settings.cropMode === "mediapipe") {
    const coordPath = join(workDir, `${basename(preparedVideo, ".mp4")}.pkl`);
    try {
      const coordResult = await createMediapipeCoords(preparedVideo, coordPath, settings);
      console.log(`MediaPipe 坐标生成完成：frames=${coordResult.frames}, detectedValidFrames=${coordResult.detectedValidFrames || coordResult.validFrames}, validFrames=${coordResult.validFrames}`);
      args.push("--use_saved_coord");
    } catch (error) {
      console.warn(`MediaPipe 坐标生成失败，回退 MuseTalk 默认坐标检测：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const inference = await run(pythonBin, args, {
    cwd: museTalkHome,
    env: {
      ...process.env,
      PYTORCH_ENABLE_MPS_FALLBACK: process.env.PYTORCH_ENABLE_MPS_FALLBACK || "1",
      PYTORCH_MPS_HIGH_WATERMARK_RATIO: process.env.PYTORCH_MPS_HIGH_WATERMARK_RATIO || "1.0",
      PYTORCH_MPS_LOW_WATERMARK_RATIO: process.env.PYTORCH_MPS_LOW_WATERMARK_RATIO || "0.7",
      OMP_NUM_THREADS: process.env.OMP_NUM_THREADS || "2",
      VECLIB_MAXIMUM_THREADS: process.env.VECLIB_MAXIMUM_THREADS || "2",
      OPENBLAS_NUM_THREADS: process.env.OPENBLAS_NUM_THREADS || "2",
      PYTHONPATH: [museTalkHome, process.env.PYTHONPATH].filter(Boolean).join(process.platform === "win32" ? ";" : ":")
    }
  });

  const generatedPath = join(resultDir, "v15", resultName);
  if (!existsSync(generatedPath)) {
    const stdout = tailText(inference.stdout);
    const stderr = tailText(inference.stderr);
    const likelyFaceError = stdout.includes("integer division or modulo by zero")
      || stdout.includes("Number of frames: 0")
      || stdout.includes("Error occurred during processing");
    const reason = likelyFaceError
      ? "MuseTalk 未生成输出视频，通常是当前素材没有检测到有效人脸区域。请更换正脸清晰素材，或重新剪辑到人物脸部完整可见的片段。"
      : "MuseTalk 未生成输出视频。";
    throw new Error([
      `${reason}`,
      `预期输出：${generatedPath}`,
      stdout ? `MuseTalk stdout:\n${stdout}` : "",
      stderr ? `MuseTalk stderr:\n${stderr}` : ""
    ].filter(Boolean).join("\n\n"));
  }
  try {
    await run(ffmpegBin, [
      "-y",
      "-i",
      generatedPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      outputPath
    ]);
  } catch {
    copyFileSync(generatedPath, outputPath);
  }
  assertFile(outputPath, "最终数字人视频");
}

const [payloadPath, outPath] = process.argv.slice(2);
if (!payloadPath || !outPath) {
  console.error("Usage: musetalk-adapter.mjs <payload.json> <output.mp4>");
  process.exit(2);
}

render(payloadPath, outPath).catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
