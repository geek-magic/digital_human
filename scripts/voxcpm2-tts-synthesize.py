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
    parser = argparse.ArgumentParser(description="Standalone VoxCPM2 synthesizer for Digital Human Factory.")
    parser.add_argument("--model", required=True, help="Local VoxCPM2 model directory.")
    parser.add_argument("--text", required=True, help="Text to synthesize.")
    parser.add_argument("--ref-audio", required=True, help="Reference voice audio path.")
    parser.add_argument("--output", required=True, help="Output wav path.")
    parser.add_argument("--device", default="auto")
    parser.add_argument("--inference-timesteps", type=int, default=10)
    parser.add_argument("--cfg-value", type=float, default=2.0)
    args = parser.parse_args()

    model_path = Path(args.model).expanduser().resolve()
    ref_audio_path = Path(args.ref_audio).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    if not model_path.exists():
        raise FileNotFoundError(f"VoxCPM2 model directory not found: {model_path}")
    if not ref_audio_path.exists():
        raise FileNotFoundError(f"Reference audio not found: {ref_audio_path}")
    if not args.text.strip():
        raise ValueError("Text is empty.")

    import soundfile as sf
    import torch
    from voxcpm import VoxCPM

    device = resolve_device(args.device, torch)
    start = time.perf_counter()
    model = VoxCPM.from_pretrained(
        str(model_path),
        load_denoiser=False,
        optimize=False,
        device=device,
        local_files_only=True,
    )
    load_ms = int((time.perf_counter() - start) * 1000)

    infer_start = time.perf_counter()
    wav = model.generate(
        text=args.text,
        reference_wav_path=str(ref_audio_path),
        inference_timesteps=args.inference_timesteps,
        cfg_value=args.cfg_value,
        normalize=False,
        denoise=False,
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(output_path), wav, model.tts_model.sample_rate)
    emit({
        "ok": True,
        "audio_path": str(output_path),
        "sample_rate": model.tts_model.sample_rate,
        "metrics": {
            "load_ms": load_ms,
            "infer_ms": int((time.perf_counter() - infer_start) * 1000),
            "device": device,
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
