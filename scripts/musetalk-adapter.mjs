#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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
    cropMode: "mediapipe",
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

function ensureMuseTalkInferencePatch(inferencePath) {
  let source = readFileSync(inferencePath, "utf-8");
  let patched = source;
  const legacyCoordLine = `            crop_coord_save_path = os.path.join(args.result_dir, "../", input_basename+".pkl")`;
  const sidecarCoordBlock = [
    `            legacy_crop_coord_save_path = os.path.join(args.result_dir, "../", input_basename+".pkl")`,
    `            sidecar_crop_coord_save_path = os.path.splitext(video_path)[0] + ".pkl"`,
    `            if args.use_saved_coord and os.path.exists(sidecar_crop_coord_save_path):`,
    `                crop_coord_save_path = sidecar_crop_coord_save_path`,
    `            else:`,
    `                crop_coord_save_path = legacy_crop_coord_save_path`
  ].join("\n");
  if (patched.includes(legacyCoordLine)) {
    patched = patched.replace(legacyCoordLine, sidecarCoordBlock);
  }
  patched = patched.replace(
    [
      "            for bbox, frame in zip(coord_list, frame_list):",
      "                if bbox == coord_placeholder:",
      "                    continue",
      "                x1, y1, x2, y2 = bbox",
      "                if args.version == \"v15\":",
      "                    y2 = y2 + args.extra_margin",
      "                    y2 = min(y2, ori_frame.shape[0])"
    ].join("\n"),
    [
      "            for bbox, frame in zip(coord_list, frame_list):",
      "                if bbox == coord_placeholder:",
      "                    continue",
      "                x1, y1, x2, y2 = bbox",
      "                if args.version == \"v15\":",
      "                    y2 = y2 + args.extra_margin",
      "                    y2 = min(y2, frame.shape[0])"
    ].join("\n")
  );
  patched = patched.replace(
    [
      "                ori_frame = copy.deepcopy(frame_list_cycle[i%(len(frame_list_cycle))])",
      "                x1, y1, x2, y2 = bbox",
      "                if args.version == \"v15\":",
      "                    y2 = y2 + args.extra_margin",
      "                    y2 = min(y2, frame.shape[0])"
    ].join("\n"),
    [
      "                ori_frame = copy.deepcopy(frame_list_cycle[i%(len(frame_list_cycle))])",
      "                x1, y1, x2, y2 = bbox",
      "                if args.version == \"v15\":",
      "                    y2 = y2 + args.extra_margin",
      "                    y2 = min(y2, ori_frame.shape[0])"
    ].join("\n")
  );
  if (patched !== source) {
    writeFileSync(inferencePath, patched);
  }
}

function pngFrameNames(dirPath) {
  if (!existsSync(dirPath)) return [];
  return readdirSync(dirPath)
    .filter((name) => /^\d{8}\.png$/i.test(name))
    .sort();
}

async function muxImageSequenceWithAudio(frameDir, audioPath, outputPath, fps = 25) {
  const tempVideoPath = join(dirname(outputPath), `temp-${basename(outputPath, ".mp4")}.mp4`);
  await run(ffmpegBin, [
    "-y",
    "-v",
    "warning",
    "-r",
    String(fps),
    "-f",
    "image2",
    "-i",
    join(frameDir, "%08d.png"),
    "-vcodec",
    "libx264",
    "-vf",
    "format=yuv420p",
    "-crf",
    "16",
    tempVideoPath
  ]);
  await run(ffmpegBin, [
    "-y",
    "-v",
    "warning",
    "-i",
    tempVideoPath,
    "-i",
    audioPath,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    outputPath
  ]);
}

async function repairMuseTalkOutputFrames({ resultDir, preparedVideo, preparedAudio, resultName, fps = 25 }) {
  const tempDir = join(resultDir, "v15");
  const inputBasename = basename(preparedVideo, ".mp4");
  const audioBasename = basename(preparedAudio, ".wav");
  const originalFrameDir = join(tempDir, inputBasename);
  const resultFrameDir = join(tempDir, `${inputBasename}_${audioBasename}`);
  const outputPath = join(tempDir, resultName);
  const originalFrames = pngFrameNames(originalFrameDir);
  if (!originalFrames.length || !existsSync(resultFrameDir)) return false;
  mkdirSync(resultFrameDir, { recursive: true });
  let generatedCount = 0;
  for (const name of originalFrames) {
    const generatedPath = join(resultFrameDir, name);
    if (existsSync(generatedPath)) {
      generatedCount += 1;
      continue;
    }
    copyFileSync(join(originalFrameDir, name), generatedPath);
  }
  if (!generatedCount) return false;
  await muxImageSequenceWithAudio(resultFrameDir, preparedAudio, outputPath, fps);
  return existsSync(outputPath);
}

async function prepareInputs(payload, workDir, namePrefix = "musetalk") {
  const maxDuration = Math.max(1, Number(process.env.MUSETALK_MAX_SEGMENT_SECONDS || 120));
  const duration = Math.min(maxDuration, Math.max(1, Number(payload.duration || 45)));
  const videoStart = Math.max(0, Number(payload.videoStart || 0));
  const audioStart = Math.max(0, Number(payload.audioStart || 0));
  const sourceVideo = resolve(payload.avatarPath);
  const sourceAudio = resolve(payload.audioPath);
  assertFile(sourceVideo, "数字人原视频");
  assertFile(sourceAudio, "口播音频");

  const preparedVideo = join(workDir, `${namePrefix}-input.mp4`);
  const preparedAudio = join(workDir, `${namePrefix}-audio.wav`);
  const videoSeekArgs = videoStart > 0 ? ["-ss", String(videoStart)] : [];
  const audioSeekArgs = audioStart > 0 ? ["-ss", String(audioStart)] : [];
  await run(ffmpegBin, [
    "-y",
    "-stream_loop",
    "-1",
    ...videoSeekArgs,
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
    ...audioSeekArgs,
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

async function prepareSegmentInputs(payload, workDir, index) {
  const segment = payload.segments?.[index] || {};
  const segmentDir = join(workDir, "segments", `segment-${String(index + 1).padStart(3, "0")}`);
  mkdirSync(segmentDir, { recursive: true });
  const namePrefix = `musetalk-segment-${String(index + 1).padStart(3, "0")}`;
  return prepareInputs({
    ...payload,
    duration: segment.duration || payload.duration,
    audioStart: segment.audioStart || 0,
    videoStart: segment.videoStart || 0
  }, segmentDir, namePrefix);
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
        coords.append((0.0, 0.0, 0.0, 0.0))
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
        coords.append((0.0, 0.0, 0.0, 0.0))
        continue
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
with open(coord_path, "wb") as f:
    pickle.dump(coords, f)
print(json.dumps({"frames": len(coords), "validFrames": detected_valid, "skippedFrames": max(0, len(coords) - detected_valid), "coordPath": coord_path}))
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

export async function render(payloadPath, outPath) {
  assertFile(payloadPath, "Adapter 输入");
  const inferencePath = join(museTalkHome, "scripts", "inference.py");
  assertFile(inferencePath, "MuseTalk 推理脚本");
  ensureMuseTalkInferencePatch(inferencePath);
  assertFile(join(museTalkHome, "models", "musetalkV15", "unet.pth"), "MuseTalk v1.5 权重");
  assertFile(join(museTalkHome, "models", "sd-vae"), "MuseTalk VAE");
  assertFile(join(museTalkHome, "models", "whisper"), "MuseTalk Whisper");

  const payload = readJson(payloadPath);
  const settings = normalizeSettings(payload.videoSettings || {});
  const outputPath = resolve(outPath);
  const workDir = dirname(outputPath);
  mkdirSync(workDir, { recursive: true });
  const segments = Array.isArray(payload.segments) && payload.segments.length ? payload.segments : [null];
  const preparedSegments = [];
  for (let index = 0; index < segments.length; index += 1) {
    preparedSegments.push(segments.length === 1
      ? await prepareInputs(payload, workDir)
      : await prepareSegmentInputs(payload, workDir, index));
  }

  const resultDir = join(workDir, "musetalk-result");
  mkdirSync(resultDir, { recursive: true });
  const resultNames = preparedSegments.map((_, index) => segments.length === 1 ? "musetalk-output.mp4" : `musetalk-output-${String(index + 1).padStart(3, "0")}.mp4`);
  const configPath = join(workDir, "musetalk-inference.yaml");
  writeFileSync(configPath, preparedSegments.flatMap((item, index) => [
    `task_${index}:`,
    ` video_path: "${item.preparedVideo.replace(/"/g, '\\"')}"`,
    ` audio_path: "${item.preparedAudio.replace(/"/g, '\\"')}"`,
    ` result_name: "${resultNames[index]}"`
  ]).join("\n"));

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
  if (["auto", "cpu", "mps", "cuda"].includes(process.env.MUSETALK_DEVICE || "")) {
    args.push("--device", process.env.MUSETALK_DEVICE);
  }

  if (settings.cropMode === "mediapipe") {
    let savedCoordCount = 0;
    try {
      for (const item of preparedSegments) {
        const coordPath = join(dirname(item.preparedVideo), `${basename(item.preparedVideo, ".mp4")}.pkl`);
        const coordResult = await createMediapipeCoords(item.preparedVideo, coordPath, settings);
        savedCoordCount += 1;
        console.log(`MediaPipe 坐标生成完成：segment=${savedCoordCount}/${preparedSegments.length}, frames=${coordResult.frames}, validFrames=${coordResult.validFrames}, skippedFrames=${coordResult.skippedFrames || 0}`);
      }
      if (savedCoordCount) args.push("--use_saved_coord");
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
  const deviceLine = String(inference.stdout || "").split(/\r?\n/).find((line) => line.includes("Using device:"));
  if (deviceLine) console.log(`MuseTalk ${deviceLine.trim()}`);

  const generatedPaths = resultNames.map((resultName) => join(resultDir, "v15", resultName));
  for (let index = 0; index < generatedPaths.length; index += 1) {
    if (!existsSync(generatedPaths[index])) {
      const repaired = await repairMuseTalkOutputFrames({
        resultDir,
        preparedVideo: preparedSegments[index].preparedVideo,
        preparedAudio: preparedSegments[index].preparedAudio,
        resultName: resultNames[index],
        fps: 25
      }).catch(() => false);
      if (repaired) {
        console.log(`MuseTalk 第 ${index + 1}/${generatedPaths.length} 段缺失帧已用原始帧补齐。无人脸帧保留原画面。`);
      }
    }
  }
  const missingIndex = generatedPaths.findIndex((item) => !existsSync(item));
  if (missingIndex !== -1) {
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
      `失败片段：${missingIndex + 1}/${generatedPaths.length}`,
      `预期输出：${generatedPaths[missingIndex]}`,
      stdout ? `MuseTalk stdout:\n${stdout}` : "",
      stderr ? `MuseTalk stderr:\n${stderr}` : ""
    ].filter(Boolean).join("\n\n"));
  }
  const generatedPath = generatedPaths.length === 1 ? generatedPaths[0] : join(workDir, "musetalk-output-concat.mp4");
  if (generatedPaths.length > 1) {
    const listPath = join(workDir, "musetalk-segments.txt");
    writeFileSync(listPath, generatedPaths.map((item) => `file '${item.replace(/'/g, "'\\''")}'`).join("\n"));
    await run(ffmpegBin, [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      generatedPath
    ]);
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [payloadPath, outPath] = process.argv.slice(2);
  if (!payloadPath || !outPath) {
    console.error("Usage: musetalk-adapter.mjs <payload.json> <output.mp4>");
    process.exit(2);
  }

  render(payloadPath, outPath).catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  });
}
