"""
Compute week-over-week and vs-baseline deltas for weekly pulse metrics.

Usage:
    python compute_deltas.py --this-week 287 --last-week 256 --baseline 264

Output (stdout):
    {
      "this_week": 287,
      "last_week": 256,
      "baseline": 264,
      "delta_wow_abs": 31,
      "delta_wow_pct": 12.11,
      "delta_baseline_abs": 23,
      "delta_baseline_pct": 8.71,
      "direction_wow": "up",
      "direction_baseline": "up"
    }

Handles edge cases:
- Division by zero (last_week=0 → returns "n/a" for delta_wow_pct)
- Missing baseline (None → delta_baseline fields omitted)
- Negative values (preserved, not abs'd)
"""

import argparse
import json
import sys


def compute_deltas(this_week, last_week, baseline=None):
    out = {
        "this_week": this_week,
        "last_week": last_week,
    }

    # Week-over-week
    out["delta_wow_abs"] = this_week - last_week
    if last_week == 0:
        out["delta_wow_pct"] = "n/a (last_week=0)"
    else:
        out["delta_wow_pct"] = round((this_week - last_week) / last_week * 100, 2)

    out["direction_wow"] = "up" if this_week > last_week else "down" if this_week < last_week else "flat"

    # Baseline
    if baseline is not None:
        out["baseline"] = baseline
        out["delta_baseline_abs"] = this_week - baseline
        if baseline == 0:
            out["delta_baseline_pct"] = "n/a (baseline=0)"
        else:
            out["delta_baseline_pct"] = round((this_week - baseline) / baseline * 100, 2)
        out["direction_baseline"] = "up" if this_week > baseline else "down" if this_week < baseline else "flat"

    return out


def main():
    parser = argparse.ArgumentParser(description="Compute deltas for weekly pulse")
    parser.add_argument("--this-week", type=float, required=True)
    parser.add_argument("--last-week", type=float, required=True)
    parser.add_argument("--baseline", type=float, default=None)
    args = parser.parse_args()

    result = compute_deltas(args.this_week, args.last_week, args.baseline)
    json.dump(result, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main()
