# Lead procedure

`<feature>` is the feature id, a short lowercase slug. Artifacts live in `.agent-team/features/<feature>/` in the run worktree of the lead's repo. They are never committed.

## 0. Repos and checks

1. **Tools.** The command needs `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and `SendMessage`. Check also `TaskCreate`, `TaskUpdate`, `TaskList` and `TaskGet`. When one of the task tools is missing, the run goes on with no task list: the ledger is the only state, and brief fields say `task_list: no`. When `SendMessage` is missing, run the units yourself in sequence and say so in one line.
2. **Triage.** Split the brief into items by repo. An item is `code` (a change in a repo), `manual` (a step in a tool with no command) or `blocked` (waits for something outside the run). Show `manual` and `blocked` items at the gate as "out of the run".
3. **Lead's repo.** The repo of the first `code` item. When the session folder is not a git repo, `cd` into that repo and read `pwd` in the next call. Write nothing in the session folder.
4. **Config.** Read `.agent-team.yml` of each repo (`config.md`). Ask the user for a value you cannot find.
5. **Run worktree.** For each repo: `git -C <repo> fetch origin <default_branch>`, then `git -C <repo> worktree add <worktree_root>/<feature>-run -b team/<feature> origin/<default_branch>`. When the branch or the worktree path already exists, it is a previous run. Do not reuse it. Add the suffix `-2`, `-3` to `<feature>` for the whole run. Reuse only on a resume (section 8).
6. **Access.** Write and remove a probe file in each run worktree with the `Write` tool. A denied write means the folder was not added to the session: ask the user to run `/add-dir`, or to leave the repo out. Ask once for all repos.
7. **Login checks.** Run `preflight` of each repo before the planner. When one fails, ask the user in the same call as the access question. Run it again before the dispatch (section 4): a login can expire during the gate.
8. **Record.** Build the repo record of each repo (`config.md`).

## 1. Plan

Start `agent-team:team-planner` once, in the background, with: `plugin_root`, `feature`, `repos` (records; the first is the lead's), the brief, the assumptions, `scope` (`both`, or `plan` when only the plan must be written again) and the user feedback when there is any. Do not ask it to parallelize. The structure comes from the work.

When the planner returns, run one `ls` on the artifact folder. `spec.md`, `plan.md`, `tasks.md` and `module-map.md` must exist and not be empty. A summary is not proof. When a file is missing, start the planner again once (`scope=both` when `spec.md` is missing, else `scope=plan`) and name the file.

Read `tasks.md` once. Check the order of the tasks: `python3 ${CLAUDE_PLUGIN_ROOT}/tools/depends-check.py .agent-team/features/<feature>/tasks.md`. On `RESULT INVALID`, or when a task depends on a task of another repo, build no unit. Start the planner once with `scope=plan` and the errors. When the problem stays, show it at the gate.

A dependency between two tasks that share no file and no symbol, only because their phases come in a given order, is suspect. Start the planner once with the feedback `Depends on only for a shared file or symbol`.

## 2. Units and team check

**Dependencies.** A task depends on another when it lists it in `Depends on:`, or when both list the same file in the same repo (the later task depends on the earlier one). A task never depends on a task of another repo: the plan states the shared shape as a contract.

**Units.** One unit for each card or story in each repo. A unit runs its tasks in order, with one teammate. Unit B depends on unit A when a task of B depends on a task of A. Drop a parent that is already an ancestor of another parent. Merge units that form a cycle. A stack has at most 4 levels: merge a deeper unit into its base parent. Units of different repos are independent.

**Final validation task.** A task that only runs lint, typecheck, the full suite or a manual smoke check is covered by the verify of each unit. Show it as `covered by unit verify`. It is never a unit. A task that compares results across units (for example text parity between two branches) is a `lead check after ship`: you run it after the pull requests exist, change nothing, and report the result at the close.

**Team check.** Minutes of a task: 0.15 for each step plus 0.2 for each file. A unit costs its task minutes plus `V`, the `verify_ship_minutes` of its repo. Count only tasks that are not final validation or lead check tasks. Use a team when one of these holds:

- (a) At least 4 tasks and at least 2 units.
- (b) At least 4 tasks in one unit or stack, whose tasks can run in parallel (width of at least 2) and a saving of at least 8 minutes. `S_b` is the sum of the task minutes and `C_b` the critical path. Verify and ship are not counted. This case is experimental.
- (c) At least 2 independent units and a saving of at least 8 minutes. `S_c` is the sum of all unit minutes. `C_c` is the largest sum of unit minutes along one chain of dependent units. The saving is `S_c - C_c`.

Near miss: when only (c) is close, with a saving of 4 to 8 minutes, offer the team and the sequence at the gate and recommend the team. Below 4, run the units in sequence.

Without task tools, (b) does not hold, and (a) or (c) needs at most 5 root units. A free task stays with the builder of its unit.

The team has at most `min(5, width)` teammates, where width is the largest number of tasks that can be ready together. It starts with one teammate for each root unit and grows only when a pull request waits for a task.

**Sequence.** Run the units yourself, one after the other, each in the run worktree of its repo, with the steps of `rules.md` as a guide. Open one pull request for each unit.

## 3. Gate

One stop. End it with `AskUserQuestion` calls, never with a free-text prompt. A bare "ok" typed in the chat answers no question.

Show: the spec in 5 lines, the plan in 5 lines, the unit table (unit, repo, cards, tasks, files, parent, number `k/N` in a stack), the dependencies of the tasks, the team check with its numbers, the `manual` and `blocked` items, and each value that the spec or the plan chose and that neither the brief nor the user gave (a default, a limit, a fallback) as an assumption.

**Call 1.** Approve or adjust, and each open question of the spec (at most 3; the others stay as assumptions in the text). Options: approve the spec, the plan and the unit table (recommended); approve and run in sequence (near miss only); decline the added scope; adjust the plan. The text of the approve option names what the approval authorizes: the `--amend` of a local unit commit when a gate or a verify fix changes it, and the `--force-with-lease` push of a child unit branch after its parent changes. Feedback about requirements goes to the planner with `scope=both`. Feedback about architecture, tasks or tests goes with `scope=plan`. After any new planner run, compute the units again and ask call 1 again.

**Call 2.** Four ship questions for every pull request:

- Push consent, before any code exists.
- Draft or ready for review.
- Run a local review before the push.
- The hold label (`hold_label`), for each repo that has an auto-merge workflow. Recommend it: a ready pull request can merge a minute after the review, and in a stack a child can merge before its parent.

Optional steps (deploy to a test environment, a bug bash) are not gate questions. Offer them at the close.

## 4. Dispatch

1. Run `preflight` again for each repo.
2. **Branch names.** On a new run, in each repo run `git ls-remote --heads origin 'team/<feature>--*'` and `git branch --list 'team/<feature>--*'`. When any exists, set `unit_suffix` to the first `-r<N>` with no match. A unit branch is `team/<feature>--<unit><unit_suffix>`.
3. **Unit worktrees.** Root unit: `git -C <path> worktree add <worktree_root>/<feature>--<unit> -b <branch> <base_sha>`. Child unit: the same, with the branch of its base parent as the start point, created after every parent is committed. For each extra parent run `git merge --no-edit <parent branch>` in the child worktree. A conflict goes to the user. Record the SHA after the merges as `start_sha`.
4. **Install.** After a worktree exists, run `install` of the repo record with a limit of 480 seconds (`perl -e 'alarm shift; exec @ARGV' 480 <install>`) and the install lock of `rules.md`. An install is done only when its exit code is 0 and the dependency folder exists and is not empty. An install that ended at once with no output has not run.
5. **Ledger.** Write `.agent-team/features/<feature>/ledger.md` (see below).
6. **Teammates.** For each root unit start one `agent-team:team-builder` in the background with the names `alpha`, `bravo`, `charlie`, `delta`, `echo`, in this order. Check that each answers by name with `SendMessage`. With a task list, create one task for each task of `tasks.md` and give the first task of each unit to its teammate before the brief. Append `<unit> assigned_at=<epoch>` and `<unit> owner=<name>` to the ledger in the same turn.
7. **Watchdog.** After the dispatch run `sleep 840; echo watchdog` in the background. When it ends, read the ledger. Apply the limits. When a unit has not changed in 14 minutes and its teammate owns it, ask `status? answer in one line` once. When a second wake-up shows no change, tell the user: unit, teammate, last event, options (retry, take over, stop). Stop the timer at the close.

**Brief of a teammate.** `role: builder` or `role: verifier`; `team_size`; `verifier` (a name or `none`); `lead: team-lead`; `task_list: yes|no`; the repo records; for each unit its name, repo, tasks in order, worktree path, branch, parent branch, and the line range in `tasks.md`; the paths of `spec.md`, `plan.md`, `tasks.md`, `rules.md`; `plugin_root`, `feature`; `pr_notes` (what the user asked for the commit type and the pull request text, word for word; omit when none); `queue` (units with no owner, when the team is smaller than the number of roots).

Use a verifier when the plan has 3 units or more and the team starts with one builder. Create it when the first unit is committed, not at the start.

**Ledger format.** Plain text, append-only.

```
# ledger <feature>
gate: team=<yes|no> push=<yes|no> local_review=<yes|no> draft=<yes|no> hold_label=<yes|no>
repo <name> path=<path> default_branch=<b> worktree_root=<w> install=<cmd> unit_suffix=<s> base_sha=<sha>
<unit> | <repo> | <branch> | <parent or -> | <start_sha or ->
<unit> assigned_at=<epoch>
<unit> owner=<name>
<unit> commit_sha=<sha>
<unit> verdict=APPROVED@<sha>
<unit> fix_cycles=<n>
<unit> pr=<n>
<unit> opened_at=<YYYY-MM-DD>
<unit> parent_tip=<sha>
<unit> note=<one line>
```

Never edit a line: append. The last line of a field wins. A verdict always carries its SHA. Store no status word. Write the ledger in the same turn as the next action.

## 5. Loop

**Turn economy.** Each of your turns rereads your whole context. Append ledger lines in the same Bash call as the next `SendMessage`. Handle events that arrive together in one turn. An idle notice or a report that needs no decision gets no text and no call. Never resend a `ship` or a `verify` because an idle notice crossed it: read the ledger first. A question to the user stops the unit: ask with `AskUserQuestion` and wait, or act without asking. Never write "tell me if you want X" and go on.

**A teammate reports a unit committed.** The first line is `unit <name> committed <full sha>`. The report must carry `gates: polish ..., prose ...` and `tdd: ...`. When the SHA or a line is missing, reply once. A `tdd: no` is a note in the ledger, not a block. Then:

1. Append `commit_sha`.
2. Measure the unit with `git -C <path> diff --shortstat <base>..<branch>`. At most 1 file and 5 lines: skip the compliance review and append `note=compliance skipped (small)`.
3. In the same turn, in the background: the compliance review (`compliance-review.md`), and each check that the repo wants after the commit (for example a security scan), one agent each. Pass an agent only the fields of its own contract, each path inside the unit worktree. Add one line (the worktree path and `run every git command with git -C <path>`) only for an agent that has the `Bash` tool and no path field. Without a verifier, the builder verifies in its own session. With one, send `verify <unit> <worktree> <base sha>`.
4. When a check reports findings, ask the user once, in the batch of the verdict: fix first, or proceed. Send no `ship` before the answer. On "fix first", treat the findings as a compliance defect.
5. When a fix changes the tree of the unit, discard the reports and run the checks again.

**A verdict.** It carries the full table of the verify: each command of `verify`, with its result. A message that shows only the test of one task is not a verdict: reply once `run the verify of the unit and report the table`.

- `APPROVED` with a test that fails only in the full run, is outside the diff, and passes alone: append `note=<test name>`, and treat it as approved.
- `APPROVED`, the compliance review has no defect, and the checks are back and answered: ship the unit.
- `REJECTED` or `BLOCKED`: show the failure to the user with two or three options, wait, and tell the teammate the chosen option. Batch the questions of several teammates.
- A compliance note is not a defect. A defect is a requirement of the spec that the code breaks or misses. A note goes to the ledger and the final report, never to the builder.
- A compliance defect goes to the teammate at once, even in the middle of a verify. It stops the verify, fixes, amends the unit commit, and verifies once.

**Changed parent.** When a parent unit changes after a child started, the parent owner sends `committed <task> <sha>` to the child owner. The child rebases onto the parent branch, merges the extra parents again and verifies again. With `task_list: no`, the signal goes to you, and you forward it to the owner of each dependent unit (the last `owner` line in the ledger).

**Limits.** A unit fails when a fourth fix cycle would be needed, or when 45 minutes pass from `assigned_at` with no approved verdict. Stop the work. Keep the branch and the worktree. For a time failure send the teammate `stop <unit>`. For a fix failure send nothing. Ask the user once: raise the limit and retry once, take over, or drop the unit. A unit that depends on a failed unit does not start. Only the user raises a limit.

**Stalled commands.** A command with no output for several minutes is not always stuck. Look at the process tree and the lock folders first. Kill only processes that belong to this run, and ask the user before you kill any other.

**Verifier balance.** A verify is the longest step. When a teammate is idle and a committed unit waits, give the verify to the idle one. Never leave a teammate idle while another has two verifies waiting.

**Growth.** Create the next teammate when a task is ready, no builder is idle and fewer than `min(5, width)` exist, and a pull request waits for that task. Do not create one for a task that no pull request waits for.

## 6. Ship

1. Ship a unit when its verify is `APPROVED`, its compliance review is done or skipped, and its checks are answered. A child waits until every parent has a pull request.
2. When the stored push answer is no, ship nothing: the unit stops at `verified`, the branch stays local, and the close lists the branches.
3. Send the teammate one `ship` message with: the stack number `k/N`, the stored answers, the unit name and the base branch (the default branch, or the parent branch for a child), the pull request number and branch of each parent, the check reports (`scan: <report>` or `scan: none needed`), `pr_notes`. Tell it not to skip any step of the ship.
4. The teammate pushes the branch and opens the pull request: title from the unit, body from the repo template with the contract between units and the links to the pull requests of the other units. It reports `PR #<n> <url>`.
5. Append `pr`, `opened_at` and `parent_tip`. Keep the local branch: a child is based on it.

## 7. Close

1. Close the final validation tasks. Stop the watchdog.
2. Run each `lead check after ship` and keep the result.
3. Report in at most 12 lines, not counting the table: unit, repo, cards, pull request, base branch and verdict; the stack order; the checks; what was not run; what was not verified. Do not paste the reports of the teammates.
4. Offer the optional steps in one `AskUserQuestion` call: deploy to a test environment for each repo that has one (one tip at a time, because the environment is shared), and a bug bash for the whole feature. Recommend no for both.
5. For each child unit, print the commands for after its parent is squash-merged, with the SHAs from the ledger: `git -C <path> fetch origin && git -C <path> rebase --onto origin/<default_branch> <old parent tip> <child branch>`, then `git push --force-with-lease` and the edit of the pull request base.
6. Do not message the teammates at the close, except for a deploy that the user accepts. An idle teammate costs nothing, and a message wakes it with a full context read.

## 8. Resume

Run this section when `ledger.md` exists, before section 4. A context compaction, a crash and a new session all land here. The ledger records what you decided. The facts of git and the code host say what is true. A fact wins.

1. Read the ledger. Rebuild the repo records from its `repo` lines. Reuse the worktrees.
2. Derive the status of each unit from the facts: pull request open or merged: `shipped`. Tip equals the last `commit_sha` and the last verdict is `APPROVED@<tip>`: `verified`. A commit above the start and a `commit_sha` equal to the tip: `committed`. Early task commits with no such line, or a branch with no commit: `building`. No branch: `queued`.
3. Do only what is missing. Start teammates again for `building` and `committed` units, with the unit branch and the worktree path.
4. When a unit changed after its last verdict, verify again.
5. With `FEATURE_ID` given and no ledger, when unit branches exist, rebuild the ledger lines from the branch names, the parents from `tasks.md` and the pull requests from the code host. Treat each verdict as unknown.

## 9. Adjust after ship

A request to change a unit that has a pull request goes to its owner (the last `owner` line), never to you. If the owner is gone, start a teammate with the unit branch and the worktree path. The owner makes a new commit (never an amend of a pushed commit), verifies again, pushes with a plain `git push` and updates the pull request. It sends `committed <task> <sha>` to the owners of the child units, and they rebase and push with `--force-with-lease`. The owner reports in 3 lines: new SHA, verdict, pull requests touched.
