#!/usr/bin/env python3
"""Check the `Depends on:` lines of a tasks.md.

Usage: depends-check.py <tasks.md>

Task format (see agents/team-planner.md):

    ## T001 <title>
    **Depends on:** none | T002, T003
    **Repo:** <name>

Reports: a duplicate task ID, a task with no `Depends on:` line, a dependency on an ID
that is not a task, a task that depends on itself, a dependency on a task of another
repo, a `Repo:` line present on some tasks and missing on others, and a cycle. Ends with one line:
`RESULT ok` or `RESULT INVALID`. Exit code 0 when ok, 1 when invalid, 2 on a usage error.
"""
import re
import sys

HEADING = re.compile(r"^#{2,3}\s+(T\d+)\b")
DEPENDS = re.compile(r"^\*\*Depends on:\*\*\s*(.*)$", re.I)
REPO = re.compile(r"^\*\*Repo:\*\*\s*(\S+)", re.I)
TASK_ID = re.compile(r"T\d+")


def parse(path):
    tasks = {}
    order = []
    duplicates = []
    current = None
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.rstrip("\n")
            head = HEADING.match(line)
            if head:
                current = head.group(1)
                if current in tasks:
                    duplicates.append(current)
                tasks[current] = {"depends": [], "has_line": False, "repo": None}
                order.append(current)
                continue
            if current is None:
                continue
            dep = DEPENDS.match(line)
            if dep:
                tasks[current]["has_line"] = True
                tasks[current]["depends"] = TASK_ID.findall(dep.group(1))
                continue
            repo = REPO.match(line)
            if repo:
                tasks[current]["repo"] = repo.group(1)
    return tasks, order, duplicates


def find_cycle(tasks):
    state = {}
    stack = []

    def visit(node):
        state[node] = 1
        stack.append(node)
        for nxt in tasks[node]["depends"]:
            if nxt not in tasks:
                continue
            if state.get(nxt) == 1:
                return stack[stack.index(nxt):] + [nxt]
            if state.get(nxt) is None:
                found = visit(nxt)
                if found:
                    return found
        stack.pop()
        state[node] = 2
        return None

    for node in tasks:
        if state.get(node) is None:
            found = visit(node)
            if found:
                return found
    return None


def main(argv):
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    tasks, order, duplicates = parse(argv[1])
    errors = []
    for task in sorted(set(duplicates)):
        errors.append(f"{task}: the ID appears more than once")
    repos = [t["repo"] for t in tasks.values()]
    if any(repos) and not all(repos):
        missing = [k for k, t in tasks.items() if not t["repo"]]
        errors.append("'Repo:' is missing on " + ", ".join(missing) + " (a plan with more than one repo needs it on every task)")
    if not tasks:
        errors.append("no task headings found (expected '## T001 <title>')")
    for task in order:
        info = tasks[task]
        if not info["has_line"]:
            errors.append(f"{task}: no 'Depends on:' line (write 'none' when it has none)")
        for dep in info["depends"]:
            if dep == task:
                errors.append(f"{task}: depends on itself")
            elif dep not in tasks:
                errors.append(f"{task}: depends on {dep}, which is not a task")
            elif info["repo"] and tasks[dep]["repo"] and info["repo"] != tasks[dep]["repo"]:
                errors.append(f"{task}: depends on {dep} of another repo ({tasks[dep]['repo']}); state a contract instead")
    cycle = find_cycle(tasks)
    if cycle:
        errors.append("cycle: " + " -> ".join(cycle))
    for message in errors:
        print("ERROR", message)
    print("RESULT ok" if not errors else "RESULT INVALID")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
