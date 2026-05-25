#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const generatorPath = join(__dirname, "llm-generate.py");

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
  const pythonCandidates = unique([
    overrides.python,
    process.env.DH_LLM_PYTHON,
    join(rootDir, "runtime", "llm", "bin", "python"),
    join(rootDir, ".venv-llm", "bin", "python")
  ]);
  const modelCandidates = unique([
    overrides.model,
    process.env.DH_LLM_MODEL_PATH,
    join(rootDir, "models", "llm", "qwen2.5-7b-instruct-4bit-mlx"),
    join(rootDir, "storage", "models", "llm", "qwen2.5-7b-instruct-4bit-mlx"),
    join(rootDir, "models", "llm", "qwen3.5-27b-4bit-mlx"),
    join(rootDir, "storage", "models", "llm", "qwen3.5-27b-4bit-mlx")
  ]);
  const python = pythonCandidates.find((item) => existsSync(item)) || "";
  const model = modelCandidates.find((item) => existsSync(item)) || "";
  const script = existsSync(generatorPath) ? generatorPath : "";
  const missing = [
    script ? "" : "LLM generator script",
    python ? "" : "LLM Python runtime",
    model ? "" : "Qwen text model weights"
  ].filter(Boolean);
  return {
    ok: missing.length === 0,
    ready: missing.length === 0,
    python,
    model,
    script,
    missing,
    searched: { python: pythonCandidates, model: modelCandidates }
  };
}

function parseJson(stdout = "") {
  const trimmed = stdout.trim();
  if (!trimmed) throw new Error("LLM tool produced no output.");
  try {
    return JSON.parse(trimmed);
  } catch {
    for (const line of trimmed.split(/\r?\n/).reverse()) {
      const candidate = line.trim();
      if (!candidate.startsWith("{")) continue;
      try {
        return JSON.parse(candidate);
      } catch {
        // Keep scanning for final JSON.
      }
    }
    throw new Error("LLM tool output is not JSON.");
  }
}

function print(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

async function chat(args) {
  const runtime = candidateRuntime({ python: args.python, model: args.model });
  if (!runtime.ready) {
    print({ ok: false, error: `LLM CLI 启动失败：缺少 ${runtime.missing.join(", ")}`, runtime });
    return 2;
  }
  const messages = args.messages || JSON.stringify([{ role: "user", content: args.prompt || "" }]);
  const { stdout } = await execFileAsync(runtime.python, [
    runtime.script,
    "--model",
    runtime.model,
    "--messages",
    messages,
    "--temperature",
    args.temperature || process.env.DH_LLM_TEMPERATURE || "0.6",
    "--max-tokens",
    args["max-tokens"] || process.env.DH_LLM_MAX_TOKENS || "900"
  ], {
    timeout: Number(args.timeout || process.env.DH_LLM_TIMEOUT_MS || 1200000),
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
  if (command === "chat") return chat(args);
  print({
    ok: false,
    error: `Unknown command: ${command}`,
    usage: [
      "node scripts/llm-tool.mjs doctor",
      "node scripts/llm-tool.mjs chat --prompt 文本"
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
