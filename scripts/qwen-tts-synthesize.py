#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
import traceback
from pathlib import Path


def emit(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Standalone Qwen3-TTS synthesizer for Digital Human Factory.")
    parser.add_argument("--model", required=True, help="Local Qwen3-TTS model directory.")
    parser.add_argument("--text", required=True, help="Text to synthesize.")
    parser.add_argument("--ref-audio", required=True, help="Reference voice audio path.")
    parser.add_argument("--output", required=True, help="Output wav path.")
    parser.add_argument("--ref-text", default="", help="Optional transcript of reference audio.")
    parser.add_argument("--language", default="Chinese")
    parser.add_argument("--device-map", default="mps")
    parser.add_argument("--dtype", default="float16")
    args = parser.parse_args()

    model_path = Path(args.model).expanduser().resolve()
    ref_audio_path = Path(args.ref_audio).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    if not model_path.exists():
        raise FileNotFoundError(f"TTS model directory not found: {model_path}")
    if not ref_audio_path.exists():
        raise FileNotFoundError(f"Reference audio not found: {ref_audio_path}")
    if not args.text.strip():
        raise ValueError("Text is empty.")

    import soundfile as sf
    import torch
    from qwen_tts import Qwen3TTSModel

    dtype = {
        "float16": torch.float16,
        "bfloat16": torch.bfloat16,
        "float32": torch.float32,
    }.get(args.dtype, torch.float16)

    start = time.perf_counter()
    model = Qwen3TTSModel.from_pretrained(str(model_path), device_map=args.device_map, dtype=dtype)
    load_ms = int((time.perf_counter() - start) * 1000)

    infer_start = time.perf_counter()
    wavs, sr = model.generate_voice_clone(
        text=args.text,
        language=args.language,
        ref_audio=str(ref_audio_path),
        ref_text=args.ref_text or "",
        x_vector_only_mode=not bool(args.ref_text),
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(output_path), wavs[0], sr)
    emit({
        "ok": True,
        "audio_path": str(output_path),
        "sample_rate": sr,
        "metrics": {
            "load_ms": load_ms,
            "infer_ms": int((time.perf_counter() - infer_start) * 1000),
        },
    })
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        emit({"ok": False, "error": str(exc), "traceback": traceback.format_exc()})
        raise SystemExit(1)
