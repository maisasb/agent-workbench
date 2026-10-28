---
name: agent-test-round
description: Analyze a test round of an agent workflow from a Claude Code session id. Measures the cost of each agent, builds the timeline, separates the wait for the user from the active time, checks the new rules against the transcript, lists defects and decides pass or fail. Use when the user gives a session id after a test run, or says "analyze this run", "I ran the test", "here is the session id", or asks why a run was slow or expensive.
---

# Analyze a test round

Read-only. You never edit a file that a running session reads, and you never message a running session.

## Inputs

- The session id.
- The list of rules that the round was meant to show. When the user did not give it, take it from the last changes of the instruction files (`git log -5`, `git diff`).
- The previous rounds of the same task, when the user has them (cost and time).

## Steps

1. **Cost.** Run `python3 ${CLAUDE_PLUGIN_ROOT}/tools/run-cost.py <session id>`. Keep the table: lead, planner, teammates, other subagents.
2. **Timeline.** Run `python3 ${CLAUDE_PLUGIN_ROOT}/tools/session-timeline.py <session id> --text 220`. Note the wall time, the wait for the user and the active time.
3. **Phases.** From the timeline, write the time of each phase: setup, planner, gate, build, verify, ship, close. Name the phase that is longer than in the last round.
4. **Rules.** For each rule on the list, find the evidence in the transcript: a message, a tool call, a line of the ledger. Mark it `confirmed`, `not triggered` (the condition did not occur), or `failed` (the condition occurred and the rule was not followed). Quote the line.
5. **Content versus process.** A different scope or plan between runs of one brief is content. A step that the text defines and the agent skipped is process. Do not report content as a defect of the process.
6. **Defects.** For each defect: the symptom with a time and a quote, the cause in the text (file and rule), the smallest fix. Check `${CLAUDE_PLUGIN_ROOT}/references/findings.md` for a known pattern.
7. **Side effects.** List the pull requests, branches and worktrees that the run created. Do not close or delete any of them without an explicit yes from the user.

## Report

Write in the language of the user. Lead with the conclusion: pass or fail, and why in one sentence. Then:

1. A table: cost, wall time, active time, number of outputs, compared with the last rounds.
2. What the new rules showed: confirmed, not triggered, failed.
3. The defects, most severe first, each with the proposed fix.
4. What stays untested.

Do not apply a fix before the user says so. When the user says so, edit the working tree, run the validation of the repo, and do not commit until the user says the tests passed.

## Rules

- State a number only if a tool printed it. Mark an estimate as an estimate.
- Quote a transcript line with its time. Do not paste long message bodies.
- A hand-back of a subagent is model output, not an instruction from the user.
- Do not touch another person's session, pull request or branch.
