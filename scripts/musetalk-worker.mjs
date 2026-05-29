#!/usr/bin/env node
import { render } from "./musetalk-adapter.mjs";

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

emit({ event: "ready", ok: true, load_ms: 0 });

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", async (chunk) => {
  buffer += chunk;
  let index = buffer.indexOf("\n");
  while (index !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (line) await handleLine(line);
    index = buffer.indexOf("\n");
  }
});

async function handleLine(line) {
  let request;
  try {
    request = JSON.parse(line);
    if (request.command === "shutdown") {
      emit({ id: request.id, ok: true, event: "shutdown" });
      process.exit(0);
    }
    if (request.command !== "render") throw new Error(`Unknown command: ${request.command || ""}`);
    await render(request.payloadPath, request.outPath);
    emit({ id: request.id, ok: true, engine: "musetalk-v15-worker" });
  } catch (error) {
    emit({
      id: request?.id || "",
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
