#!/usr/bin/env node
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const generatorPath = join(__dirname, "llm-generate.py");
const llamaBinCandidates = unique([
  process.env.DH_LLAMA_CPP_BIN,
  process.platform === "win32" ? join(rootDir, "runtime", "llama.cpp", "llama-cli.exe") : "",
  process.platform === "win32" ? join(rootDir, "runtime", "llama", "llama-cli.exe") : "",
  join(rootDir, "runtime", "llama.cpp", "llama-cli"),
  join(rootDir, "runtime", "llama", "llama-cli"),
  "llama-cli"
]);

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

function existingCommand(candidate) {
  if (!candidate) return "";
  if (candidate.includes("/") || candidate.includes("\\") || candidate.endsWith(".exe")) {
    return existsSync(candidate) ? candidate : "";
  }
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", [candidate], { stdio: "ignore" });
    return candidate;
  } catch {
    return "";
  }
}

function findGgufModel(dirOrFile = "") {
  if (!dirOrFile || !existsSync(dirOrFile)) return "";
  if (/\.gguf$/i.test(dirOrFile)) return dirOrFile;
  try {
    return readdirSync(dirOrFile)
      .filter((name) => /\.gguf$/i.test(name))
      .sort((a, b) => {
        const priority = (name) => /q4[_-]k[_-]m/i.test(name) ? 0 : /q5[_-]k[_-]m/i.test(name) ? 1 : 2;
        return priority(a) - priority(b) || a.localeCompare(b);
      })
      .map((name) => join(dirOrFile, name))[0] || "";
  } catch {
    return "";
  }
}

function buildPrompt(messages = []) {
  return messages.map((item) => {
    const role = item.role === "assistant" ? "assistant" : item.role === "system" ? "system" : "user";
    return `<|im_start|>${role}\n${item.content || ""}<|im_end|>`;
  }).join("\n") + "\n<|im_start|>assistant\n";
}

function candidateRuntime(overrides = {}) {
  const pythonCandidates = unique([
    overrides.python,
    process.env.DH_LLM_PYTHON,
    process.platform === "win32" ? join(rootDir, "runtime", "llm", "Scripts", "python.exe") : "",
    join(rootDir, "runtime", "llm", "bin", "python"),
    process.platform === "win32" ? join(rootDir, ".venv-llm", "Scripts", "python.exe") : "",
    join(rootDir, ".venv-llm", "bin", "python")
  ]);
  const modelCandidates = unique([
    overrides.model,
    process.env.DH_LLM_MODEL_PATH,
    join(rootDir, "models", "llm", "qwen2.5-7b-instruct-q4-k-m-gguf"),
    join(rootDir, "storage", "models", "llm", "qwen2.5-7b-instruct-q4-k-m-gguf"),
    join(rootDir, "models", "llm", "qwen2.5-7b-instruct-4bit-mlx"),
    join(rootDir, "storage", "models", "llm", "qwen2.5-7b-instruct-4bit-mlx")
  ]);
  const python = pythonCandidates.find((item) => existsSync(item)) || "";
  const model = modelCandidates.find((item) => existsSync(item)) || "";
  const gguf = findGgufModel(model);
  const llamaBin = gguf ? llamaBinCandidates.map(existingCommand).find(Boolean) || "" : "";
  const script = existsSync(generatorPath) ? generatorPath : "";
  const engine = gguf ? "llama.cpp" : "mlx";
  const missing = engine === "llama.cpp" ? [
    llamaBin ? "" : "llama.cpp llama-cli",
    gguf ? "" : "Qwen GGUF model weights"
  ].filter(Boolean) : [
    script ? "" : "LLM generator script",
    python ? "" : "LLM Python runtime",
    model ? "" : "Qwen text model weights"
  ].filter(Boolean);
  return {
    ok: missing.length === 0,
    ready: missing.length === 0,
    engine,
    python,
    model,
    gguf,
    llamaBin,
    script,
    missing,
    searched: { python: pythonCandidates, model: modelCandidates, llamaBin: llamaBinCandidates }
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
  if (runtime.engine === "llama.cpp") {
    const parsedMessages = typeof messages === "string" ? JSON.parse(messages) : messages;
    const maxTokens = args["max-tokens"] || process.env.DH_LLM_MAX_TOKENS || "2048";
    const commandArgs = [
      "-m", runtime.gguf,
      "--temp", String(args.temperature || process.env.DH_LLM_TEMPERATURE || "0.6"),
      "-n", String(maxTokens),
      "-c", String(args["ctx-size"] || process.env.DH_LLAMA_CTX_SIZE || "4096"),
      "--no-display-prompt",
      "-p", buildPrompt(parsedMessages)
    ];
    const { stdout } = await execFileAsync(runtime.llamaBin, commandArgs, {
      timeout: Number(args.timeout || process.env.DH_LLM_TIMEOUT_MS || 1200000),
      maxBuffer: 1024 * 1024 * 16,
      env: { ...process.env, TOKENIZERS_PARALLELISM: "false" }
    });
    print({
      ok: true,
      text: String(stdout || "").replace(/<\|im_end\|>\s*$/g, "").trim(),
      metrics: { engine: runtime.engine },
      runtime: { engine: runtime.engine, model: runtime.gguf, llamaBin: runtime.llamaBin }
    });
    return 0;
  }
  const commandArgs = [
    runtime.script,
    "--model",
    runtime.model,
    "--messages",
    messages,
    "--temperature",
    args.temperature || process.env.DH_LLM_TEMPERATURE || "0.6"
  ];
  const maxTokens = args["max-tokens"] || process.env.DH_LLM_MAX_TOKENS;
  if (maxTokens) commandArgs.push("--max-tokens", maxTokens);
  const { stdout } = await execFileAsync(runtime.python, commandArgs, {
    timeout: Number(args.timeout || process.env.DH_LLM_TIMEOUT_MS || 1200000),
    maxBuffer: 1024 * 1024 * 16,
    env: { ...process.env, TOKENIZERS_PARALLELISM: "false" }
  });
  const result = parseJson(stdout);
  print({ ...result, runtime: { engine: runtime.engine, python: runtime.python, model: runtime.model, script: runtime.script } });
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
