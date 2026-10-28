---
name: agent-team-design
description: Design rules for a Claude Code command in which a lead agent splits a feature into units and teammates build them at the same time. Covers the unit definition, the team check with numbers, the ledger, the limits, the messages, and what teammates cannot do. Use when the user designs or reviews a multi-agent command, asks whether a team pays off, or asks how to coordinate teammates and subagents.
---

# Design a lead and teammates command

Read `${CLAUDE_PLUGIN_ROOT}/references/pattern.md` for the full pattern and `${CLAUDE_PLUGIN_ROOT}/references/claude-code-lessons.md` for what Claude Code allows. This skill is the short form.

## Decide first

1. **Is a team worth it?** Estimate the minutes of each unit (task minutes plus the verify and ship minutes of the stack). The saving is the sum minus the longest chain. Under 4 minutes, run the plain flow. Between 4 and 8, offer both. At 8 or more, use the team.
2. **What is a unit?** One card or story in one repo, with its own branch, worktree and pull request. Units of different repos are independent. Stacks stay inside one repo.
3. **What stays with the lead?** The plan, the gate, the ledger, every question to the user, every subagent dispatch, the close.

## Design rules

- **One gate.** Spec, plan, unit table and ship questions in one stop. State the numbers of the team check there.
- **The plan has one structure.** No condition such as "if X then split". A condition becomes an open question at the gate.
- **A dependency names a shared file or symbol.** Never the order of phases.
- **Teammates never start subagents and never ask the user.** They send the lead a `dispatch` request or a question. Their reports must carry the full SHA, the gate results and the test-first line.
- **The ledger is append-only.** Store facts: owner, SHA, verdict with its SHA, pull request, parent tip. Store no status word. On resume, the facts of git win.
- **Limits belong to the user.** Fix cycles and minutes for each unit. A unit that reaches a limit stops, and the user chooses.
- **Heavy commands take a lock.** Installs, and heavy test suites in the same repo.
- **Checks that can run in parallel do.** Compliance review and security scan run while the verify runs.
- **Check each tool before you depend on it.** A session can lack the task list tools. Define a mode without them.
- **Run the login checks before the planner**, and again before the dispatch.

## Before you ship the design

1. Run the skill `agent-consistency-sweep` over the files.
2. Run a test round (`agent-test-round`) with a repeatable task, then a regression with an old task.
3. List the modes that no real run exercised, and put the list in the pull request.
