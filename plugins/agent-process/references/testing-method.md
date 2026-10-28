# Testing method for an agent workflow

A text instruction for an agent is code that you cannot compile. Test it in real runs, and read the transcript.

## Before a round

1. Pick the code version. A tester loads the plugin from a folder (`--plugin-dir`) and pulls before each round. A stale checkout gives a wrong result.
2. Use one session for one run. A fresh session has no memory of the last run.
3. Do not edit a file that a running session reads. The lead reads some sections late, and an edit changes what it reads.
4. Pick a task that you can repeat. A repeated task gives numbers you can compare.
5. List what the round must show: the rules that changed since the last round.

## During a round

- Answer optional offers with "no": deploys, extra reviews, demos.
- Do not help the agent. A correction from you hides a defect of the text.
- Note the time of each stop that needs you. You will subtract it later.

## After a round

Give the session id to the analysis. Run `tools/run-cost.py` and `tools/session-timeline.py` (the skill `agent-test-round` does both).

Report in this order: the conclusion, cost and time, what the new rules showed, the defects, what stays untested.

- **Cost.** Equivalent input tokens: input + 0.1 × cache read + 1.25 × cache write + 5 × output. Compare runs with this number, not with money.
- **Time.** Use two numbers: wall time, and active time (wall time minus the wait for the user). Compare active time.
- **Phase times.** Planner, gate, build, verify, ship. Find the phase that grew.

## Compare runs

- Same task, same repo state. A repo that moved changes the plan.
- A plan can differ between runs of the same brief. The planner reads the code each time. Treat a change in scope as content, not as a defect of the process.
- Keep a table: run, case, cost, time, result. Add one line for each run.

## Regression

After a change of the text, run an old task that passed before. Check the structure of the artifacts, the ledger format, the number of pull requests and the cost range. A different number is a finding, not a failure, until you know the cause.

## When to commit

Commit and push after the user says the tests passed. Do not commit after each edit. A batch of edits, one test round, one commit.

## Side effects of tests

A test run creates real pull requests, branches and worktrees. Close and delete them only after an explicit yes from the user. List them first.

## What stays untested

Keep a list of rules that no real run exercised. Put it in the pull request description. A rule that nobody ran is a claim, not a fact.
