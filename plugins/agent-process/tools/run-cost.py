#!/usr/bin/env python3
"""Token cost of one Claude Code session, for each agent.

Usage: run-cost.py <session id> [--projects-dir DIR]

Reads the transcript of the session and the transcripts of its subagents and
teammates. Counts each message id once. Prints no message content.

Equivalent input tokens = input + 0.1 * cache read + 1.25 * cache write + 5 * output.
The weights follow the usual price ratios of one model family. Use the result to
compare runs, not as a bill.
"""
import argparse
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

W_CACHE_READ = 0.1
W_CACHE_WRITE = 1.25
W_OUTPUT = 5.0


def projects_dir(arg):
    return Path(arg or os.environ.get("CLAUDE_PROJECTS_DIR") or Path.home() / ".claude" / "projects")


def find_session(root, session_id):
    for path in root.glob(f"*/{session_id}.jsonl"):
        return path
    return None


def agent_label(path):
    """Name of an agent file: the description of its meta file, or the name in the file name."""
    stem = path.stem  # agent-<id> or agent-a<name>-<hash>
    meta = path.with_suffix(".meta.json")
    description = ""
    if meta.exists():
        try:
            data = json.loads(meta.read_text())
            description = data.get("description") or data.get("agentType") or ""
        except (OSError, ValueError):
            pass
    rest = stem[len("agent-"):] if stem.startswith("agent-") else stem
    named = re.match(r"^a(?P<name>[A-Za-z][\w-]*?)-[0-9a-f]{8,}$", rest)
    if named:
        return named.group("name")
    return rest[:18] + (f" ({description[:32]})" if description else "")


def read_usage(path, seen):
    """Sum the usage of one transcript. Skip message ids already counted."""
    totals = defaultdict(float)
    models = defaultdict(float)
    count = 0
    with path.open() as handle:
        for line in handle:
            try:
                row = json.loads(line)
            except ValueError:
                continue
            message = row.get("message")
            if not isinstance(message, dict):
                continue
            usage = message.get("usage")
            if not usage:
                continue
            key = message.get("id") or row.get("uuid")
            if key in seen:
                continue
            seen.add(key)
            inp = usage.get("input_tokens", 0) or 0
            write = usage.get("cache_creation_input_tokens", 0) or 0
            read = usage.get("cache_read_input_tokens", 0) or 0
            out = usage.get("output_tokens", 0) or 0
            totals["input"] += inp
            totals["write"] += write
            totals["read"] += read
            totals["output"] += out
            eq = inp + W_CACHE_READ * read + W_CACHE_WRITE * write + W_OUTPUT * out
            totals["eq"] += eq
            models[message.get("model") or "unknown"] += eq
            count += 1
    totals["msgs"] = count
    return totals, models


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("session")
    parser.add_argument("--projects-dir")
    args = parser.parse_args()

    root = projects_dir(args.projects_dir)
    main_file = find_session(root, args.session)
    if not main_file:
        print(f"session {args.session} not found under {root}", file=sys.stderr)
        return 1

    files = [("lead", main_file)]
    sub_dir = main_file.parent / args.session / "subagents"
    if sub_dir.is_dir():
        for path in sorted(sub_dir.glob("agent-*.jsonl")):
            files.append((agent_label(path), path))

    seen = set()
    rows = []
    by_model = defaultdict(float)
    for label, path in files:
        totals, models = read_usage(path, seen)
        rows.append((label, totals))
        for name, eq in models.items():
            by_model[name] += eq

    print(f"{'agent':<34}{'msgs':>6}{'input':>9}{'c.write':>11}{'c.read':>12}{'output':>9}{'eq.input':>12}")
    total = defaultdict(float)
    for label, t in rows:
        print(f"{label[:33]:<34}{int(t['msgs']):>6}{int(t['input']):>9}{int(t['write']):>11}{int(t['read']):>12}{int(t['output']):>9}{int(t['eq']):>12}")
        for key in ("msgs", "input", "write", "read", "output", "eq"):
            total[key] += t[key]
    print(f"{'TOTAL':<34}{int(total['msgs']):>6}{int(total['input']):>9}{int(total['write']):>11}{int(total['read']):>12}{int(total['output']):>9}{int(total['eq']):>12}")
    print("by model (eq.input): " + ", ".join(f"{m}={int(v)}" for m, v in sorted(by_model.items())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
