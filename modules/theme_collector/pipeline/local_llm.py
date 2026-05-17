"""
Local LLM client via Ollama API.
Handles routing decisions: which tasks go to local vs cloud LLM.

Architecture decisions:
  - Ollama REST API at localhost:11434 (no SDK dependency)
  - Default model: qwen2.5:14b-instruct-q4_K_M (fits 16GB VRAM)
  - JSON mode via format parameter
  - No retry on local (fast, no rate limits)
  - Cost: $0 per call (electricity only)
  - Logging to same llm-calls.log as Gemini (unified cost tracking)
"""

import json
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
LLM_LOG = REPO_ROOT / "data" / "llm-calls.log"

OLLAMA_BASE = "http://localhost:11434"
DEFAULT_MODEL = "qwen2.5:14b-instruct-q4_K_M"


def check_ollama() -> dict:
    """Check if Ollama is running and model is available."""
    try:
        r = requests.get(f"{OLLAMA_BASE}/api/tags", timeout=5)
        r.raise_for_status()
        models = [m["name"] for m in r.json().get("models", [])]
        has_default = DEFAULT_MODEL in models
        return {"status": "ok", "models": models, "default_available": has_default}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def call_local_llm(
    prompt: str,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.3,
    max_tokens: int = 16000,
    step_name: str = "unknown",
    theme_slug: str = "unknown",
    json_mode: bool = False,
) -> str:
    """Call local LLM via Ollama API."""
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }
    if json_mode:
        payload["format"] = "json"

    start_ms = time.monotonic_ns() // 1_000_000
    r = requests.post(f"{OLLAMA_BASE}/api/generate", json=payload, timeout=300)
    r.raise_for_status()
    latency_ms = (time.monotonic_ns() // 1_000_000) - start_ms

    data = r.json()
    text = data.get("response", "")

    # Token counts from Ollama response
    input_tokens = data.get("prompt_eval_count", 0)
    output_tokens = data.get("eval_count", 0)

    # Log (cost = $0 for local)
    LLM_LOG.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).isoformat()
    with open(LLM_LOG, "a") as f:
        f.write(f"{timestamp} | {step_name} | local:{model} | {input_tokens} | {output_tokens} | $0.0000 | {latency_ms}ms | {theme_slug}\n")

    return text


# ─── LLM Routing ────────────────────────────────────────────────────

# Routing table: which step uses which LLM
# "cloud" = Gemini 2.5 Pro, "local" = Qwen 2.5 14B via Ollama
ROUTING = {
    "step1": "cloud",     # Community Analysis — quality critical, long context
    "step2": "cloud",     # Verdict Synthesis — editorial moat, quality non-negotiable
    "step3": "cloud",     # JSON Formatter — too large for Qwen 14B (10K+ input, 8K+ output)
    "classify": "local",  # Short classification tasks — good fit for local
    "summarize": "local", # Short summaries (e.g., Reddit thread relevance)
    "cleanup": "none",    # Pure Python, no LLM
    "taxonomies": "none", # Pure Python, no LLM
    "search_profile": "none",  # Pure Python, no LLM
}
# NOTE: Step 3 tested on Qwen 14B Q4 (2026-05-17): incomplete output
# (12/17 keys, 2/10 pain points). Input too large for effective context.
# Candidate for re-test with Qwen 32B or after context window improvements.


def get_router(step_name: str) -> str:
    """Return routing decision for a pipeline step."""
    return ROUTING.get(step_name, "cloud")


def set_routing(step_name: str, target: str):
    """Override routing for a step. Use 'cloud', 'local', or 'none'."""
    if target not in ("cloud", "local", "none"):
        raise ValueError(f"Invalid routing target: {target}")
    ROUTING[step_name] = target
