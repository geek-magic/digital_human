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
  voxcpm2: join(__dirname, "voxcpm2-tts-synthesize.py")
};

const defaults = {
  language: process.env.DH_TTS_LANGUAGE || "Chinese",
  deviceMap: process.env.DH_TTS_DEVICE_MAP || "auto",
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
  const engine = "voxcpm2";
  const pythonCandidates = unique([
    overrides.python,
    process.env.DH_TTS_PYTHON,
    process.platform === "win32" ? join(rootDir, "runtime", "tts", "Scripts", "python.exe") : "",
    join(rootDir, "runtime", "tts", "bin", "python"),
    process.platform === "win32" ? join(rootDir, ".venv-tts", "Scripts", "python.exe") : "",
    join(rootDir, ".venv-tts", "bin", "python")
  ]);
  const modelCandidates = unique([
    overrides.model,
    process.env.DH_VOXCPM2_MODEL_PATH,
    join(rootDir, "models", "tts", "voxcpm2"),
    join(rootDir, "storage", "models", "tts", "voxcpm2")
  ]);
  const python = pythonCandidates.find((item) => existsSync(item)) || "";
  const model = modelCandidates.find((item) => existsSync(item)) || "";
  const synthesizerPath = synthesizers[engine] || synthesizers.voxcpm2;
  const script = existsSync(synthesizerPath) ? synthesizerPath : "";
  const missing = [
    script ? "" : "TTS synthesizer script",
    python ? "" : "TTS Python runtime",
    model ? "" : "VoxCPM2 model weights"
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

const stylePrompts = {
  natural: "",
  passionate: "passionate, energetic, powerful tone, inspiring, slightly faster pace",
  sad_low: "deep, low voice, sad and restrained tone, slow pace, soft expression",
  gentle: "gentle, warm, friendly tone, soft expression, relaxed pace",
  professional: "calm, professional, confident tone, steady pace",
  cheerful: "bright, cheerful, lively tone, friendly and upbeat",
  urgent: "tense, urgent, fast pace, serious tone",
  custom: ""
};

function stylePrefix(args) {
  const preset = Object.hasOwn(stylePrompts, args["style-preset"]) ? args["style-preset"] : "natural";
  const prompt = [stylePrompts[preset], args["style-prompt"] || ""].filter(Boolean).join(", ").trim();
  if (!prompt) return "";
  const intensity = args["style-intensity"] || "medium";
  const intensityText = intensity === "light" ? "subtle" : intensity === "strong" ? "strong, expressive" : "";
  return `(${[intensityText, prompt].filter(Boolean).join(", ")})`;
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
    `${stylePrefix(args)}${args.text}`,
    "--ref-audio",
    args["ref-audio"],
    "--output",
    args.output
  ];
  const modelArgs = [
    "--device",
    args.device || process.env.DH_VOXCPM2_DEVICE || defaults.deviceMap,
    "--inference-timesteps",
    String(args["inference-timesteps"] || process.env.DH_VOXCPM2_INFERENCE_TIMESTEPS || 10),
    "--cfg-value",
    String(args["cfg-value"] || process.env.DH_VOXCPM2_CFG_VALUE || 2.0),
    "--seed",
    String(args.seed || process.env.DH_VOXCPM2_SEED || 20260606)
  ];
  if (args["prompt-audio"] && args["prompt-text"]) {
    modelArgs.push("--prompt-audio", args["prompt-audio"], "--prompt-text", args["prompt-text"]);
  }
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
