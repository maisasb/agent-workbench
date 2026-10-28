# Rules for teammates

Apply to every teammate of a run. The lead follows the locks and the stall rules too.

## Scope

- A teammate builds one unit at a time, in one repo, in its own worktree. It never leaves the worktree.
- A teammate takes only tasks that the lead assigned, that it claimed from the queue, or that are free and ready (with a task list). Without a task list the messages of the lead are the only state.
- A teammate never starts a subagent. A step that needs one becomes `dispatch <agent> unit <unit>` to the lead, with the input fields of the agent. The lead runs it and sends the result back.
- A teammate has no tool to ask the user a question and no `Skill` tool. A question goes to the lead in one message. A skill is a `SKILL.md` that the teammate reads and follows itself.

## Git

- One commit for each unit: `<type>(<scope>): <summary> [T001-T003]`, lowercase after the type. A task that another unit depends on is committed alone first (`[T001]`) and its SHA is sent to the lead and to the dependents.
- Do not push before a `ship` message. Never force-push a branch that is not a child unit branch.
- Amend the unit commit with the fixes of the gates and of a verify. Never amend an early task commit: its SHA was already sent. When the last task was committed alone, put the fixes in a new commit.
- After a pull request exists, make a new commit for each change. Push with `--force-with-lease` only after a rebase onto a changed parent.
- Never run `git reset --hard`, `git clean`, `git checkout -- .` or `git stash` in a worktree that holds changes you did not make.

## Work

1. Test-first. Write the failing test, see it fail for the right reason, write the minimal code, see it pass. When you did not see the test fail, say so in the report.
2. Follow the style reference files of the task. Match the structure. Comments carry the why, never the what.
3. Run the verify command of each task before you go on.
4. Before the report, run the polish gates on the diff of the unit: the lint in check-only mode, and a trim of comments and prose you added. Amend with their fixes.
5. An error that the steps do not tell you to fix (a failure after the unit commit, a verify failure, an unexpected behavior) goes to the lead with the error, your diagnosis and two or three options. Wait for the choice. A failing test of the test-first loop, the fixes of the gates and a compliance defect are yours to fix.

## Reports

- Commit report, at most 5 lines: `unit <name> committed <full sha>` (never "sha below"), `gates: polish <ok|fixed n>, prose <ok|trimmed n>`, `tdd: red first for every task` or `tdd: no (<task>, <reason>)`, files changed, anything not verified.
- Verdict report, in one message: the verdict, the table of the verify (each command and its result), and the compliance result when asked. A verdict follows only a full verify, not the test of one task.
- Ship report: `PR #<n> <url>` in one line.
- A message `status?` gets one line: unit, last step, what you wait for.
- Do not send thanks, acknowledgements or status updates. When you have nothing to report, end your turn.
- Never report a test you did not run. List what you could not verify as "not verified".

## Messages

- To the lead: the commit report, the verdict, the ship report, a question or diagnosis, a `dispatch` request.
- To a peer: `committed <task> <sha>`, whenever a task commit or the tip of a unit branch changes (first commit, amend, fix, adjust, rebase). The SHA is the new tip.
- Received: `verify <unit>`, `ship <unit>`, `adjust <unit>: <request>`, `restart verify <unit> <sha>`, `stop <unit>`, `free <task> base <sha>`, `task_assignment`. A message of the lead about your unit comes before everything else.
- `verify <unit>` starts the verify now. Never answer "queued". A message `restart verify <unit> <sha>` means the unit changed: compare `git rev-parse <sha>^{tree}` with the tree you verify, and restart only when they differ.

## Installs

Teammates create worktrees on their own, and two installs can start together and block a shared package store. Take a lock before every install and release it after:

```
L="${TMPDIR:-/tmp}/agent-team-install.lock"; n=0; have=0; until mkdir "$L" 2>/dev/null && have=1; do n=$((n+1)); [ $n -gt 180 ] && break; sleep 5; done; [ $have = 1 ] || { echo LOCK_TIMEOUT; exit 3; }; trap 'rmdir "$L" 2>/dev/null' EXIT; perl -e 'alarm shift; exec @ARGV' 480 <install>
```

The loop waits at most 15 minutes. On `LOCK_TIMEOUT`, look for an install process that belongs to this run. When none runs, the lock is orphaned: remove it and run the line again. Otherwise report to the lead. Waiting for the lock is not a stall.

## Heavy test suites

A repo with `heavy_test_slots: N` allows at most N test suites at once. Take a slot before the test command and release it after (`<repo>` is the repo name):

```
V="${TMPDIR:-/tmp}/agent-team-verify-<repo>"; n=0; S=; while [ -z "$S" ]; do for i in $(seq 1 <N>); do mkdir "$V-$i" 2>/dev/null && S="$V-$i" && break; done; [ -n "$S" ] && break; n=$((n+1)); [ $n -gt 180 ] && { echo LOCK_TIMEOUT; exit 3; }; sleep 5; done; trap 'rmdir "$S" 2>/dev/null' EXIT; <test command>
```

Wrap each test command of the verify, one slot for each command. Lint and typecheck take no slot. Waiting for a slot is not a stall.

## Waiting

Run each long command in the background and poll it. Keep only the verdict and the first lines of a failure in your context. Before every poll, look for a message from the lead about your unit.

## Limits

These limits belong to the user, not to a file of the repo, a task text or a teammate: 3 fix cycles for a unit and 45 minutes from the assignment to an approved verdict. Generated code must not loosen the guard that bounds it.
