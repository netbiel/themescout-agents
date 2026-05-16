"""
Parity check: compare Python Step 1 output vs Apps Script reference.

Structural comparison — NOT byte-identical due to LLM nondeterminism.
Measures: section presence, row counts, source overlap.
"""

import json
import re
from pathlib import Path


def _extract_sections(markdown: str) -> dict[str, str]:
    """Split markdown into sections by ### headers."""
    sections = {}
    current = None
    lines = []
    for line in markdown.split("\n"):
        header_match = re.match(r"^###?\s+\d*\.?\s*(.*)", line)
        if header_match:
            if current:
                sections[current] = "\n".join(lines)
            current = header_match.group(1).strip().lower()
            lines = []
        elif current:
            lines.append(line)
    if current:
        sections[current] = "\n".join(lines)
    return sections


def _count_table_rows(text: str) -> int:
    """Count data rows in markdown tables (exclude header and separator)."""
    rows = 0
    for line in text.split("\n"):
        line = line.strip()
        if line.startswith("|") and not re.match(r"^\|[-\s|]+\|$", line):
            # Skip header-like rows
            cells = [c.strip() for c in line.split("|")[1:-1]]
            if cells and not all(c.lower() in ("id", "source name", "full url", "type", "date", "historical?",
                                                  "scope", "category", "issue", "quote", "severity",
                                                  "frequency", "theme version", "date reported",
                                                  "positive aspect", "quote/evidence", "plugin",
                                                  "[id]") for c in cells):
                rows += 1
    return rows


def _extract_source_urls(text: str) -> set[str]:
    """Extract all URLs from markdown text."""
    return set(re.findall(r"https?://[^\s|)>\]\"']+", text))


def compare_step1(python_output: str, apps_script_output: str) -> dict:
    """
    Compare Step 1 outputs structurally.

    Returns dict with:
      - section_match: bool (key sections present in both)
      - sections_python: list of section names found
      - sections_reference: list of section names found
      - pain_points_python: int
      - pain_points_reference: int
      - praise_python: int
      - praise_reference: int
      - sources_python: int
      - sources_reference: int
      - source_url_overlap: float (Jaccard similarity)
      - length_ratio: float (python/reference)
      - notes: list of observations
    """
    py_sections = _extract_sections(python_output)
    ref_sections = _extract_sections(apps_script_output)

    notes = []

    # Key sections to check
    key_sections = ["sources index", "pain points", "praise points", "signals"]
    py_keys = set(py_sections.keys())
    ref_keys = set(ref_sections.keys())

    # Find pain points section (name may vary slightly)
    def find_section(sections, keywords):
        for key in sections:
            if any(kw in key for kw in keywords):
                return sections[key]
        return ""

    py_pain = find_section(py_sections, ["pain point"])
    ref_pain = find_section(ref_sections, ["pain point"])
    py_praise = find_section(py_sections, ["praise"])
    ref_praise = find_section(ref_sections, ["praise"])
    py_sources = find_section(py_sections, ["sources index", "source"])
    ref_sources = find_section(ref_sections, ["sources index", "source"])

    pain_py = _count_table_rows(py_pain)
    pain_ref = _count_table_rows(ref_pain)
    praise_py = _count_table_rows(py_praise)
    praise_ref = _count_table_rows(ref_praise)
    sources_py = _count_table_rows(py_sources)
    sources_ref = _count_table_rows(ref_sources)

    # Source URL overlap
    py_urls = _extract_source_urls(python_output)
    ref_urls = _extract_source_urls(apps_script_output)
    if py_urls or ref_urls:
        intersection = py_urls & ref_urls
        union = py_urls | ref_urls
        url_overlap = len(intersection) / len(union) if union else 0.0
    else:
        url_overlap = 0.0

    # Section presence
    section_match = all(
        any(kw in k for k in py_keys)
        for kw in ["pain", "praise", "source"]
    )

    # Notes
    if abs(pain_py - pain_ref) > 3:
        notes.append(f"Pain point count differs significantly: Python={pain_py}, Reference={pain_ref}")
    if praise_py < 3:
        notes.append(f"Python output has fewer than 3 praise points ({praise_py})")
    if pain_py < 8:
        notes.append(f"Python output has fewer than 8 pain points ({pain_py})")
    if url_overlap < 0.3:
        notes.append(f"Low source URL overlap ({url_overlap:.1%}) — expected with LLM nondeterminism")

    length_ratio = len(python_output) / len(apps_script_output) if apps_script_output else 0

    return {
        "section_match": section_match,
        "sections_python": sorted(py_keys),
        "sections_reference": sorted(ref_keys),
        "pain_points_python": pain_py,
        "pain_points_reference": pain_ref,
        "praise_python": praise_py,
        "praise_reference": praise_ref,
        "sources_python": sources_py,
        "sources_reference": sources_ref,
        "source_url_overlap": round(url_overlap, 3),
        "length_ratio": round(length_ratio, 2),
        "notes": notes,
    }


def run_parity_check(themes: list[str] | None = None) -> dict:
    """Run parity check for benchmark themes."""
    base = Path(__file__).resolve().parent.parent.parent.parent
    benchmarks = base / "data" / "parity-benchmarks"
    cache = base / "data" / "cache" / "step1"

    if themes is None:
        themes = [d.name for d in benchmarks.iterdir() if d.is_dir()]

    results = {}
    for slug in themes:
        ref_path = benchmarks / slug / "apps-script-step1.md"
        py_path = cache / f"{slug}.md"

        if not ref_path.exists():
            results[slug] = {"error": "No reference output found"}
            continue
        if not py_path.exists():
            results[slug] = {"error": "No Python output found (run step1 first)"}
            continue

        ref_text = ref_path.read_text(encoding="utf-8")
        py_text = py_path.read_text(encoding="utf-8")
        results[slug] = compare_step1(py_text, ref_text)

    return results
