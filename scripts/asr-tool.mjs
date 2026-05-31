#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const transcriberPath = join(__dirname, "qwen-asr-transcribe.py");

const defaults = {
  language: process.env.DH_ASR_LANGUAGE || "Chinese",
  deviceMap: process.env.DH_ASR_DEVICE_MAP || "auto",
  dtype: process.env.DH_ASR_DTYPE || "float16",
  maxNewTokens: process.env.DH_ASR_MAX_NEW_TOKENS || "1024"
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
    if (["json"].includes(key)) {
      args[key] = true;
      continue;
    }
    args[key] = argv[index + 1] || "";
    index += 1;
  }
  return { command, args };
}

function unique(values) {
  return values.filter((item, index, arr) => item && arr.indexOf(item) === index);
}

function candidateRuntime(overrides = {}) {
  const pythonCandidates = unique([
    overrides.python,
    process.env.DH_ASR_PYTHON,
    process.platform === "win32" ? join(rootDir, "runtime", "asr", "Scripts", "python.exe") : "",
    join(rootDir, "runtime", "asr", "bin", "python"),
    process.platform === "win32" ? join(rootDir, ".venv-asr", "Scripts", "python.exe") : "",
    join(rootDir, ".venv-asr", "bin", "python")
  ]);
  const modelCandidates = unique([
    overrides.model,
    process.env.DH_ASR_MODEL_PATH,
    join(rootDir, "models", "asr", "qwen3-asr-1.7b"),
    join(rootDir, "storage", "models", "asr", "qwen3-asr-1.7b")
  ]);
  const python = pythonCandidates.find((item) => existsSync(item)) || "";
  const model = modelCandidates.find((item) => existsSync(item)) || "";
  const script = existsSync(transcriberPath) ? transcriberPath : "";
  const missing = [
    script ? "" : "ASR transcriber script",
    python ? "" : "ASR Python runtime",
    model ? "" : "Qwen3-ASR model weights"
  ].filter(Boolean);
  return {
    ok: missing.length === 0,
    ready: missing.length === 0,
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
  if (!trimmed) throw new Error("ASR tool produced no output.");
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
    throw new Error("ASR tool output is not JSON.");
  }
}

function print(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

async function transcribe(args) {
  const runtime = candidateRuntime({ python: args.python, model: args.model });
  if (!runtime.ready) {
    print({
      ok: false,
      error: `ASR CLI 启动失败：缺少 ${runtime.missing.join(", ")}`,
      runtime
    });
    return 2;
  }
  if (!args.audio || !existsSync(args.audio)) {
    print({ ok: false, error: `Audio file not found: ${args.audio || ""}`, runtime });
    return 2;
  }
  const { stdout } = await execFileAsync(runtime.python, [
    runtime.script,
    "--model",
    runtime.model,
    "--audio",
    args.audio,
    "--language",
    args.language || defaults.language,
    "--device-map",
    args["device-map"] || args.deviceMap || defaults.deviceMap,
    "--dtype",
    args.dtype || defaults.dtype,
    "--max-new-tokens",
    args["max-new-tokens"] || args.maxNewTokens || defaults.maxNewTokens
  ], {
    timeout: Number(args.timeout || process.env.DH_ASR_TIMEOUT_MS || 1200000),
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
  if (command === "transcribe") {
    return transcribe(args);
  }
  print({
    ok: false,
    error: `Unknown command: ${command}`,
    usage: [
      "node scripts/asr-tool.mjs doctor",
      "node scripts/asr-tool.mjs transcribe --audio /path/to/audio.wav"
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
