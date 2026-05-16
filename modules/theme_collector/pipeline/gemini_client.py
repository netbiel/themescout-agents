"""
Gemini API client wrapper with retry logic and cost logging.
"""

import time
from datetime import datetime, timezone
from pathlib import Path

import google.generativeai as genai
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
LLM_LOG = REPO_ROOT / "data" / "llm-calls.log"

# Cost estimates per 1M tokens (Gemini 2.5 Pro as of 2026-05)
COST_PER_1M_INPUT = 1.25
COST_PER_1M_OUTPUT = 10.00


def configure(api_key: str):
    """Configure Gemini with API key."""
    genai.configure(api_key=api_key)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=4, max=60),
    retry=retry_if_exception_type((Exception,)),
)
def call_gemini(
    prompt: str,
    model_name: str = "gemini-2.5-pro",
    temperature: float = 0.3,
    max_output_tokens: int = 65000,
    step_name: str = "unknown",
    theme_slug: str = "unknown",
    json_mode: bool = False,
) -> str:
    """Call Gemini API with retry and logging."""
    model = genai.GenerativeModel(model_name)

    generation_config = {
        "temperature": temperature,
        "max_output_tokens": max_output_tokens,
    }
    if json_mode:
        generation_config["response_mime_type"] = "application/json"

    start_ms = time.monotonic_ns() // 1_000_000
    response = model.generate_content(prompt, generation_config=generation_config)
    latency_ms = (time.monotonic_ns() // 1_000_000) - start_ms

    text = response.text

    # Extract token counts
    input_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0)
    output_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0)
    est_cost = (input_tokens / 1_000_000 * COST_PER_1M_INPUT) + (output_tokens / 1_000_000 * COST_PER_1M_OUTPUT)

    # Log
    LLM_LOG.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).isoformat()
    with open(LLM_LOG, "a") as f:
        f.write(f"{timestamp} | {step_name} | {model_name} | {input_tokens} | {output_tokens} | ${est_cost:.4f} | {latency_ms}ms | {theme_slug}\n")

    return text
