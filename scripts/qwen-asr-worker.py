#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import time
import traceback
from pathlib import Path


def emit(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Persistent Qwen3-ASR worker.")
    parser.add_argument("--model", required=True)
    parser.add_argument("--language", default="Chinese")
    parser.add_argument("--device-map", default="mps")
    parser.add_argument("--dtype", default="float16")
    parser.add_argument("--max-new-tokens", type=int, default=1024)
    args = parser.parse_args()

    model_path = Path(args.model).expanduser().resolve()
    if not model_path.exists():
        raise FileNotFoundError(f"ASR model directory not found: {model_path}")

    import torch
    from qwen_asr import Qwen3ASRModel

    dtype = {
        "float16": torch.float16,
        "bfloat16": torch.bfloat16,
        "float32": torch.float32,
    }.get(args.dtype, torch.float16)

    load_start = time.perf_counter()
    model = Qwen3ASRModel.from_pretrained(
        str(model_path),
        dtype=dtype,
        device_map=args.device_map,
        max_inference_batch_size=1,
        max_new_tokens=args.max_new_tokens,
    )
    load_ms = int((time.perf_counter() - load_start) * 1000)
    emit({"event": "ready", "ok": True, "load_ms": load_ms, "model": str(model_path)})

    for line in sys.stdin:
        try:
            request = json.loads(line)
            request_id = request.get("id", "")
            command = request.get("command", "transcribe")
            if command == "shutdown":
                emit({"id": request_id, "ok": True, "event": "shutdown"})
                return 0
            if command != "transcribe":
                raise ValueError(f"Unknown command: {command}")
            audio_path = Path(request.get("audio", "")).expanduser().resolve()
            if not audio_path.exists():
                raise FileNotFoundError(f"Audio file not found: {audio_path}")
            infer_start = time.perf_counter()
            results = model.transcribe(audio=str(audio_path), language=request.get("language") or args.language)
            first = results[0]
            emit({
                "id": request_id,
                "ok": True,
                "text": getattr(first, "text", str(first)),
                "language": getattr(first, "language", request.get("language") or args.language),
                "metrics": {
                    "load_ms": 0,
                    "infer_ms": int((time.perf_counter() - infer_start) * 1000),
                    "worker_warm": True,
                },
            })
        except Exception as exc:
            emit({
                "id": request.get("id", "") if "request" in locals() else "",
                "ok": False,
                "error": str(exc),
                "traceback": traceback.format_exc(),
            })
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        emit({"event": "ready", "ok": False, "error": str(exc), "traceback": traceback.format_exc()})
        raise SystemExit(1)
