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
    parser = argparse.ArgumentParser(description="Standalone MLX LLM generator for Digital Human Factory.")
    parser.add_argument("--model", required=True, help="Local MLX model directory.")
    parser.add_argument("--messages", required=True, help="JSON array of chat messages.")
    parser.add_argument("--temperature", type=float, default=0.6)
    parser.add_argument("--max-tokens", type=int, default=900)
    args = parser.parse_args()

    model_path = Path(args.model).expanduser().resolve()
    if not model_path.exists():
        raise FileNotFoundError(f"LLM model directory not found: {model_path}")
    messages = json.loads(args.messages)
    if not isinstance(messages, list) or not messages:
        raise ValueError("Messages must be a non-empty JSON array.")

    from mlx_lm import generate, load
    from mlx_lm.sample_utils import make_sampler

    load_start = time.perf_counter()
    model, tokenizer = load(str(model_path))
    load_ms = int((time.perf_counter() - load_start) * 1000)

    if hasattr(tokenizer, "apply_chat_template") and tokenizer.chat_template is not None:
        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    else:
        prompt = "".join(
            f"<|im_start|>{item.get('role', 'user')}\n{item.get('content', '')}<|im_end|>\n"
            for item in messages
        ) + "<|im_start|>assistant\n"

    infer_start = time.perf_counter()
    text = generate(
        model,
        tokenizer,
        prompt=prompt,
        sampler=make_sampler(temp=args.temperature),
        max_tokens=args.max_tokens,
        verbose=False,
    )
    emit({
        "ok": True,
        "text": text,
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
