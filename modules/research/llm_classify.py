"""
Local LLM classification for Reddit threads.
Uses Qwen 2.5 14B to assess thread relevance and draft response fitness.

Short prompts (~500 tokens input) — perfect for local LLM.
"""

import json

from modules.theme_collector.pipeline.local_llm import call_local_llm


def classify_thread(title: str, selftext: str, subreddit: str) -> dict:
    """
    Classify a Reddit thread for ThemeScout relevance.
    Returns: {relevance: 0-10, category, response_fit, reasoning}
    """
    prompt = f"""Classify this Reddit thread for a WordPress theme review site (ThemeScout).

Subreddit: r/{subreddit}
Title: {title}
Content: {selftext[:300]}

Rate on JSON format:
{{
  "relevance": 0-10 (10=directly about WP themes we cover),
  "category": "theme_question|theme_comparison|builder_discussion|general_wp|off_topic",
  "response_fit": "high|medium|low|none",
  "reasoning": "one sentence why"
}}

Reply with ONLY the JSON object."""

    result = call_local_llm(
        prompt=prompt,
        step_name="classify",
        theme_slug="reddit",
        json_mode=True,
        max_tokens=200,
        temperature=0.1,
    )

    try:
        return json.loads(result)
    except json.JSONDecodeError:
        return {"relevance": 0, "category": "parse_error", "response_fit": "none",
                "reasoning": f"Failed to parse: {result[:100]}"}


def batch_classify(threads: list[dict]) -> list[dict]:
    """Classify multiple threads, return sorted by relevance."""
    results = []
    for t in threads:
        classification = classify_thread(
            title=t.get("title", ""),
            selftext=t.get("selftext_preview", t.get("selftext", "")),
            subreddit=t.get("subreddit", ""),
        )
        results.append({**t, "llm_classification": classification})

    results.sort(key=lambda x: x["llm_classification"].get("relevance", 0), reverse=True)
    return results
