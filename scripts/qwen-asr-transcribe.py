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
    parser = argparse.ArgumentParser(description="Standalone Qwen3-ASR transcriber for Digital Human Factory.")
    parser.add_argument("--model", required=True, help="Local Qwen3-ASR model directory.")
    parser.add_argument("--audio", required=True, help="Audio file path.")
    parser.add_argument("--language", default="Chinese")
    parser.add_argument("--device-map", default="auto")
    parser.add_argument("--dtype", default="float16")
    parser.add_argument("--max-new-tokens", type=int, default=1024)
    args = parser.parse_args()

    model_path = Path(args.model).expanduser().resolve()
    audio_path = Path(args.audio).expanduser().resolve()
    if not model_path.exists():
        raise FileNotFoundError(f"ASR model directory not found: {model_path}")
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    import torch
    from qwen_asr import Qwen3ASRModel

    device_map = resolve_device(args.device_map, torch)
    dtype = {
        "float16": torch.float16,
        "bfloat16": torch.bfloat16,
        "float32": torch.float32,
    }.get(args.dtype, torch.float16)

    start = time.perf_counter()
    model = Qwen3ASRModel.from_pretrained(
        str(model_path),
        dtype=dtype,
        device_map=device_map,
        max_inference_batch_size=1,
        max_new_tokens=args.max_new_tokens,
    )
    load_ms = int((time.perf_counter() - start) * 1000)

    infer_start = time.perf_counter()
    results = model.transcribe(audio=str(audio_path), language=args.language)
    first = results[0]
    emit({
        "ok": True,
        "text": getattr(first, "text", str(first)),
        "language": getattr(first, "language", args.language),
        "metrics": {
            "load_ms": load_ms,
            "infer_ms": int((time.perf_counter() - infer_start) * 1000),
            "device": device_map,
        },
    })
    return 0


def resolve_device(value: str, torch_module) -> str:
    requested = (value or "auto").lower()
    if requested == "auto":
        if torch_module.cuda.is_available():
            return "cuda"
        if getattr(torch_module.backends, "mps", None) and torch_module.backends.mps.is_available():
            return "mps"
        return "cpu"
    if requested.startswith("cuda") and not torch_module.cuda.is_available():
        return "cpu"
    if requested == "mps" and (not getattr(torch_module.backends, "mps", None) or not torch_module.backends.mps.is_available()):
        return "cpu"
    return requested


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        emit({"ok": False, "error": str(exc), "traceback": traceback.format_exc()})
        raise SystemExit(1)
