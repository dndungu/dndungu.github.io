#!/usr/bin/env python3
"""Aggregate local Claude Code session logs into a small usage report.

Reads every ~/.claude/projects/**/*.jsonl transcript on this machine, sums
token usage per day, per hour, and per model, and merges the daily/model
totals into usage/<machine>.json in this repo. The hourly series is not
merged (see below) — it only backs a rolling "last 24 hours" figure.

Merged, not overwritten: local session logs are not a permanent record — they
can be pruned, and a project directory can be deleted along with its logs.
Each run recomputes a fresh aggregate from whatever logs currently exist and
merges it into the existing report, so a day's numbers, once captured and
committed, survive even if the local logs behind them are later gone. That's
what makes usage/<machine>.json a real "over time" history rather than a
rolling window bounded by local log retention.
"""
import argparse
import glob
import json
import os
from collections import defaultdict
from datetime import datetime, timezone

USAGE_FIELDS = (
    "input_tokens",
    "output_tokens",
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
)


def iter_usage_records(claude_dir):
    pattern = os.path.join(claude_dir, "projects", "**", "*.jsonl")
    for path in glob.glob(pattern, recursive=True):
        try:
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        rec = json.loads(line)
                    except ValueError:
                        continue
                    if rec.get("type") != "assistant" or rec.get("isApiErrorMessage"):
                        continue
                    message = rec.get("message") or {}
                    usage = message.get("usage")
                    model = message.get("model")
                    ts = rec.get("timestamp")
                    if not usage or not model or model == "<synthetic>" or not ts:
                        continue
                    yield ts, model, usage
        except OSError:
            continue


def scan(claude_dir):
    """Fresh aggregate from whatever local logs exist right now."""
    daily = defaultdict(lambda: defaultdict(int))
    hourly = defaultdict(lambda: defaultdict(int))
    models = defaultdict(lambda: defaultdict(int))
    for ts, model, usage in iter_usage_records(claude_dir):
        date = ts[:10]  # YYYY-MM-DD, UTC
        hour = ts[:13]  # YYYY-MM-DDTHH, UTC
        daily[date]["messages"] += 1
        hourly[hour]["messages"] += 1
        models[model]["messages"] += 1
        for field in USAGE_FIELDS:
            val = usage.get(field) or 0
            daily[date][field] += val
            hourly[hour][field] += val
            models[model][field] += val
    return daily, hourly, models


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--machine", required=True, help="label for this machine, e.g. mac-laptop")
    ap.add_argument("--claude-dir", default=os.path.expanduser("~/.claude"))
    ap.add_argument("--out-dir", default=os.path.join(os.path.dirname(__file__), "..", "usage"))
    args = ap.parse_args()

    out_dir = os.path.abspath(args.out_dir)
    out_path = os.path.join(out_dir, f"{args.machine}.json")

    existing = {"daily": [], "models": {}}
    if os.path.exists(out_path):
        with open(out_path, "r", encoding="utf-8") as f:
            existing = json.load(f)

    fresh_daily, fresh_hourly, fresh_models = scan(args.claude_dir)

    # A date in the fresh scan is authoritative (a full re-read of whatever
    # logs currently exist for it); a date missing from the fresh scan but
    # present in the existing file means its local logs are gone, so keep
    # what was already captured.
    merged_daily = {d: v for d, v in {row["date"]: row for row in existing.get("daily", [])}.items()}
    for date, counts in fresh_daily.items():
        merged_daily[date] = dict(counts)
    daily_out = [{"date": d, **merged_daily[d]} for d in sorted(merged_daily)]

    merged_models = {m: dict(v) for m, v in existing.get("models", {}).items()}
    for model, counts in fresh_models.items():
        bucket = merged_models.setdefault(model, {})
        for field, val in counts.items():
            bucket[field] = max(bucket.get(field, 0), val)

    totals = defaultdict(int)
    for row in daily_out:
        for field in USAGE_FIELDS + ("messages",):
            totals[field] += row.get(field, 0)

    # Not merged with history: this only backs a rolling "last 24 hours" figure,
    # which needs true hourly resolution (daily buckets can't tell "today so
    # far" from "the last 24 hours"). Local logs for the last couple of days
    # are always still on disk, so a fresh recompute is enough here.
    hourly_out = [{"hour": h, **fresh_hourly[h]} for h in sorted(fresh_hourly)][-72:]

    report = {
        "machine": args.machine,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "totals": dict(totals),
        "daily": daily_out,
        "hourly": hourly_out,
        "models": merged_models,
    }

    os.makedirs(out_dir, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
        f.write("\n")

    print(f"wrote {out_path} ({totals['messages']} messages, {len(daily_out)} days)")


if __name__ == "__main__":
    main()
