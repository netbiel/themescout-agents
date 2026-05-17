"""L1 Rule: Score derivation — handoff_score matches calculation from enums."""

from __future__ import annotations


def _issue(theme, field, severity, msg):
    from ..l1_structural import ValidationIssue
    return ValidationIssue(theme=theme, field_path=field, severity=severity, expected_or_issue=msg)


WEIGHTS_PANEL = {"minimal": 0, "moderate": 1, "complex": 2, "overwhelming": 3}
WEIGHTS_DOCS = {"excellent": 0, "good": 1, "basic": 2, "poor": 3}
WEIGHTS_CURVE = {"minutes": 0, "hours": 1, "days": 2, "weeks": 3}


def check_score_derivation(data: dict, theme: str) -> list:
    issues = []

    hd = data.get("handoff_difficulty", {})
    stored_score = hd.get("handoff_score", 0) or 0

    panel = (hd.get("handoff_panel_complexity") or "").lower()
    docs = (hd.get("handoff_docs_quality") or "").lower()
    curve = (hd.get("handoff_learning_curve") or "").lower()

    p = WEIGHTS_PANEL.get(panel, 2)
    d = WEIGHTS_DOCS.get(docs, 2)
    c = WEIGHTS_CURVE.get(curve, 2)
    expected = max(1, min(10, 10 - (p + d + c)))

    if stored_score != expected:
        issues.append(_issue(theme, "handoff_difficulty.handoff_score", "error",
                             f"Stored score {stored_score} doesn't match derived {expected} "
                             f"(panel={panel}/{p}, docs={docs}/{d}, curve={curve}/{c})"))

    return issues
