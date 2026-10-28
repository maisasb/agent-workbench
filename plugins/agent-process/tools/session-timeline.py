#!/usr/bin/env python3
"""Timeline of one Claude Code session.

Usage: session-timeline.py <session id> [--projects-dir DIR] [--text N]

Prints, in time order: the agents that the session started, the questions to the
user with the wait time of each, and, with --text N, the first N characters of each
text line of the lead. Ends with the total time, the wait for the user and the
active time (total minus wait). Reads the main transcript only.
"""
import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path


def parse(stamp):
    return datetime.fromisoformat(stamp.replace("Z", "+00:00"))


def find_session(root, session_id):
    for path in root.glob(f"*/{session_id}.jsonl"):
        return path
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("session")
    parser.add_argument("--projects-dir")
    parser.add_argument("--text", type=int, default=0)
    args = parser.parse_args()

    root = Path(args.projects_dir or os.environ.get("CLAUDE_PROJECTS_DIR") or Path.home() / ".claude" / "projects")
    path = find_session(root, args.session)
    if not path:
        print(f"session {args.session} not found under {root}", file=sys.stderr)
        return 1

    rows = []
    with path.open() as handle:
        for line in handle:
            try:
                rows.append(json.loads(line))
            except ValueError:
                continue

    stamps = [r["timestamp"] for r in rows if r.get("timestamp")]
    if not stamps:
        print("no timestamps in the transcript", file=sys.stderr)
        return 1
    start, end = parse(min(stamps)), parse(max(stamps))

    pending = {}
    waits = []
    events = []
    for row in rows:
        message = row.get("message")
        if not isinstance(message, dict):
            continue
        content = message.get("content")
        if isinstance(content, str):
            continue
        for block in content or []:
            kind = block.get("type")
            if row.get("type") == "assistant" and kind == "tool_use":
                name = block.get("name")
                data = block.get("input", {})
                if name == "Agent":
                    label = data.get("name") or data.get("subagent_type") or "agent"
                    events.append((row["timestamp"], f"AGENT {label}: {data.get('description', '')}"))
                elif name == "AskUserQuestion":
                    pending[block["id"]] = row["timestamp"]
                    for q in data.get("questions", []):
                        events.append((row["timestamp"], f"ASK {q.get('question', '')[:110]}"))
            elif row.get("type") == "assistant" and kind == "text" and args.text and block.get("text", "").strip():
                events.append((row["timestamp"], "TEXT " + block["text"][: args.text].replace("\n", " | ")))
            elif row.get("type") == "user" and kind == "tool_result" and block.get("tool_use_id") in pending:
                began = pending.pop(block["tool_use_id"])
                seconds = (parse(row["timestamp"]) - parse(began)).total_seconds()
                waits.append(seconds)
                events.append((row["timestamp"], f"ANSWER after {int(seconds)} s"))

    for stamp, text in sorted(events):
        print(stamp[11:19], text)

    total = (end - start).total_seconds()
    wait = sum(waits)
    print()
    print(f"total  {total / 60:.1f} min")
    print(f"wait   {wait / 60:.1f} min for the user in {len(waits)} question calls")
    print(f"active {(total - wait) / 60:.1f} min")
    return 0


if __name__ == "__main__":
    sys.exit(main())
