---
name: agent-consistency-sweep
description: Check a set of instruction files (a command, its agents and its reference files) for conflicts, gaps and unclear text after edits. Runs a read-only review by an independent agent, verifies each finding against the text, and applies the smallest fix. Use when the user asks to check for conflicts, to review the text before a commit, or to make sure a rule does not contradict another one.
---

# Consistency sweep over instruction files

Instruction files are code that you cannot compile. A rule added in one file often contradicts an older rule in another file. This skill finds those cases.

## Steps

1. **List the files.** Name every file of the set and the edits since the last sweep (`git diff`). The newest edits conflict with older text most often.
2. **Mechanical checks.** Run these first, they are cheap:
   - Every reference to a section, step, field or file points to something that exists.
   - Every message name that one file sends is handled by the file that receives it.
   - Every tool that a step needs exists for the role that runs it.
   - The repo validation script passes.
3. **Independent review.** Start one read-only subagent. Give it the file list, the last edits and the brief below. Do not give it your conclusions: an agent that holds your hypothesis returns it confirmed.
4. **Verify each finding.** Read the lines the reviewer names. Mark each one `confirmed`, `not a defect` (with the reason) or `intended`. Reviewers report wrong findings, and they miss the fix that other text already holds.
5. **Fix.** Make the smallest edit for each confirmed finding. Keep one rule in one place and point to it from the other. Do not add a patch sentence that explains an old rule: rewrite the old rule.
6. **Validate.** Run the validation script. Read the edited paragraphs once more for new conflicts.
7. **Report.** Findings by kind, what you changed, what you left and why.

## Brief for the reviewer

State the files, say "read-only, edit nothing", and ask for at most 20 findings, most severe first. For each: file and line, a short quote, why it conflicts or fails, the smallest fix, and a kind:

- CONFLICT: two places give different rules for the same thing (names, formats, numbers, limits, who runs what).
- GAP: a rule that cannot be followed in a mode (one repo, many repos, no task list, with and without a verifier, resume, fallback) or a step that a role cannot run because a tool is missing.
- AMBIGUITY: text with more than one meaning that hides a rule.

Tell it to skip style preferences and to end with the count by kind.

## Checklist of modes

For each mode, ask what data the lead needs after its context is compacted, and check that a file holds it:

- A single unit and many units.
- One repo and many repos.
- With and without a task list.
- With and without a verifier.
- A resume after a crash.
- The fallback to the plain flow.

## Rules

- A finding about text that a real run did not exercise stays a claim. Say so in the report.
- Do not edit files that a running session reads.
- Commit after the user says the tests passed, not after the sweep.
