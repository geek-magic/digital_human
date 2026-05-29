#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const synthesizers = {
  qwen3: join(__dirname, "qwen-tts-synthesize.py"),
  voxcpm2: join(__dirname, "voxcpm2-tts-synthesize.py")
};

const defaults = {
  language: process.env.DH_TTS_LANGUAGE || "Chinese",
  deviceMap: process.env.DH_TTS_DEVICE_MAP || "mps",
  dtype: process.env.DH_TTS_DTYPE || "float16"
};

function parseArgs(argv) {
  const command = argv[0] || "doctor";
  const args = { _: [] };
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    args[key] = argv[index + 1] || "";
    index += 1;
  }
  return { command, args };
}

function unique(values) {
  return values.filter((item, index, arr) => item && arr.indexOf(item) === index);
}

function candidateRuntime(overrides = {}) {
  const engine = normalizeEngine(overrides.engine || process.env.DH_TTS_ENGINE || "voxcpm2");
  const pythonCandidates = unique([
    overrides.python,
    process.env.DH_TTS_PYTHON,
    join(rootDir, "runtime", "tts", "bin", "python"),
    join(rootDir, ".venv-tts", "bin", "python")
  ]);
  const modelCandidates = engine === "voxcpm2"
    ? unique([
        overrides.model,
        process.env.DH_VOXCPM2_MODEL_PATH,
        join(rootDir, "models", "tts", "voxcpm2"),
        join(rootDir, "storage", "models", "tts", "voxcpm2")
      ])
    : unique([
        overrides.model,
        process.env.DH_QWEN_TTS_MODEL_PATH,
        process.env.DH_TTS_MODEL_PATH,
        join(rootDir, "models", "tts", "qwen3-tts-12hz-1.7b-base"),
        join(rootDir, "storage", "models", "tts", "qwen3-tts-12hz-1.7b-base")
      ]);
  const python = pythonCandidates.find((item) => existsSync(item)) || "";
  const model = modelCandidates.find((item) => existsSync(item)) || "";
  const synthesizerPath = synthesizers[engine] || synthesizers.voxcpm2;
  const script = existsSync(synthesizerPath) ? synthesizerPath : "";
  const missing = [
    script ? "" : "TTS synthesizer script",
    python ? "" : "TTS Python runtime",
    model ? "" : `${engine === "voxcpm2" ? "VoxCPM2" : "Qwen3-TTS"} model weights`
  ].filter(Boolean);
  return {
    ok: missing.length === 0,
    ready: missing.length === 0,
    engine,
    python,
    model,
    script,
    missing,
    searched: {
      python: pythonCandidates,
      model: modelCandidates
    }
  };
}

function normalizeEngine(value = "") {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("qwen")) return "qwen3";
  if (normalized.includes("voxcpm")) return "voxcpm2";
  return normalized === "qwen3" ? "qwen3" : "voxcpm2";
}

function parseJson(stdout = "") {
  const trimmed = stdout.trim();
  if (!trimmed) throw new Error("TTS tool produced no output.");
  try {
    return JSON.parse(trimmed);
  } catch {
    for (const line of trimmed.split(/\r?\n/).reverse()) {
      const candidate = line.trim();
      if (!candidate.startsWith("{")) continue;
      try {
        return JSON.parse(candidate);
      } catch {
        // Keep scanning for the final JSON payload.
      }
    }
    throw new Error("TTS tool output is not JSON.");
  }
}

function print(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

async function synthesize(args) {
  const runtime = candidateRuntime({ python: args.python, model: args.model, engine: args.engine || args["model-id"] });
  if (!runtime.ready) {
    print({
      ok: false,
      error: `TTS CLI 启动失败：缺少 ${runtime.missing.join(", ")}`,
      runtime
    });
    return 2;
  }
  if (!args["ref-audio"] || !existsSync(args["ref-audio"])) {
    print({ ok: false, error: `参考音色文件不存在：${args["ref-audio"] || ""}`, runtime });
    return 2;
  }
  if (!args.text || !args.text.trim()) {
    print({ ok: false, error: "口播文本为空。", runtime });
    return 2;
  }
  if (!args.output) {
    print({ ok: false, error: "缺少输出音频路径。", runtime });
    return 2;
  }
  const commonArgs = [
    runtime.script,
    "--model",
    runtime.model,
    "--text",
    args.text,
    "--ref-audio",
    args["ref-audio"],
    "--output",
    args.output
  ];
  const modelArgs = runtime.engine === "voxcpm2"
    ? [
        "--device",
        args.device || process.env.DH_VOXCPM2_DEVICE || defaults.deviceMap,
        "--inference-timesteps",
        String(args["inference-timesteps"] || process.env.DH_VOXCPM2_INFERENCE_TIMESTEPS || 10),
        "--cfg-value",
        String(args["cfg-value"] || process.env.DH_VOXCPM2_CFG_VALUE || 2.0)
      ]
    : [
        "--ref-text",
        args["ref-text"] || "",
        "--language",
        args.language || defaults.language,
        "--device-map",
        args["device-map"] || defaults.deviceMap,
        "--dtype",
        args.dtype || defaults.dtype
      ];
  const { stdout } = await execFileAsync(runtime.python, [...commonArgs, ...modelArgs], {
    timeout: Number(args.timeout || process.env.DH_TTS_TIMEOUT_MS || 1200000),
    maxBuffer: 1024 * 1024 * 16,
    env: { ...process.env, TOKENIZERS_PARALLELISM: "false" }
  });
  const result = parseJson(stdout);
  print({ ...result, runtime: { python: runtime.python, model: runtime.model, script: runtime.script } });
  return result.ok ? 0 : 1;
}

async function main() {
  const { command, args } = parseArgs(process.argv.slice(2));
  if (command === "doctor") {
    print(candidateRuntime({ python: args.python, model: args.model }));
    return 0;
  }
  if (command === "synthesize") {
    return synthesize(args);
  }
  print({
    ok: false,
    error: `Unknown command: ${command}`,
    usage: [
      "node scripts/tts-tool.mjs doctor",
      "node scripts/tts-tool.mjs synthesize --text 文本 --ref-audio /path/ref.wav --output /path/out.wav"
    ]
  });
  return 2;
}

try {
  const code = await main();
  process.exit(code);
} catch (error) {
  print({ ok: false, error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
}
