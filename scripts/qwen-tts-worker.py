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
    parser = argparse.ArgumentParser(description="Persistent Qwen3-TTS worker.")
    parser.add_argument("--model", required=True)
    parser.add_argument("--language", default="Chinese")
    parser.add_argument("--device-map", default="auto")
    parser.add_argument("--dtype", default="float16")
    args = parser.parse_args()

    model_path = Path(args.model).expanduser().resolve()
    if not model_path.exists():
        raise FileNotFoundError(f"TTS model directory not found: {model_path}")

    import soundfile as sf
    import torch
    from qwen_tts import Qwen3TTSModel

    device_map = resolve_device(args.device_map, torch)
    dtype = {
        "float16": torch.float16,
        "bfloat16": torch.bfloat16,
        "float32": torch.float32,
    }.get(args.dtype, torch.float16)

    load_start = time.perf_counter()
    model = Qwen3TTSModel.from_pretrained(str(model_path), device_map=device_map, dtype=dtype)
    load_ms = int((time.perf_counter() - load_start) * 1000)
    emit({"event": "ready", "ok": True, "load_ms": load_ms, "model": str(model_path), "device": device_map})

    for line in sys.stdin:
        try:
            request = json.loads(line)
            request_id = request.get("id", "")
            command = request.get("command", "synthesize")
            if command == "shutdown":
                emit({"id": request_id, "ok": True, "event": "shutdown"})
                return 0
            if command != "synthesize":
                raise ValueError(f"Unknown command: {command}")
            ref_audio_path = Path(request.get("ref_audio", "")).expanduser().resolve()
            output_path = Path(request.get("output", "")).expanduser().resolve()
            text = str(request.get("text") or "")
            if not ref_audio_path.exists():
                raise FileNotFoundError(f"Reference audio not found: {ref_audio_path}")
            if not text.strip():
                raise ValueError("Text is empty.")
            infer_start = time.perf_counter()
            wavs, sr = model.generate_voice_clone(
                text=text,
                language=request.get("language") or args.language,
                ref_audio=str(ref_audio_path),
                ref_text=request.get("ref_text") or "",
                x_vector_only_mode=not bool(request.get("ref_text")),
            )
            output_path.parent.mkdir(parents=True, exist_ok=True)
            sf.write(str(output_path), wavs[0], sr)
            emit({
                "id": request_id,
                "ok": True,
                "audio_path": str(output_path),
                "sample_rate": sr,
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
        emit({"event": "ready", "ok": False, "error": str(exc), "traceback": traceback.format_exc()})
        raise SystemExit(1)
