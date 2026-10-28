# Pattern: a lead and teammates

The numbers in this file (minutes, limits, counts) are starting values from a few test rounds on a few stacks. Measure your own and replace them.

This file describes a command in which one lead agent splits a feature into units, and teammates build the units at the same time. Each unit becomes one pull request.

## Roles

- **Lead.** Owns the plan, the gate, the ledger and the close. Never edits the code of a unit.
- **Planner.** A subagent that writes the spec, the plan and the task list once, for all repos.
- **Teammate.** Builds one unit in its own git worktree, commits it, verifies it, and opens the pull request when the lead says `ship`.
- **Verifier.** A teammate that only verifies. Create it when the plan has three units or more and the team starts with one builder.

## Unit

A unit is one card or story in one repo. A unit has its own branch, worktree and pull request.

- Units of different repos are independent and run in parallel.
- Units of one repo can form a stack. A child unit starts from the branch of its parent, and its pull request has the parent branch as base.
- Two tasks that change the same file belong to the same unit or to a stack.

## Flow

1. **Setup.** Resolve the repos, prove write access, run the login checks, create one clean worktree for each repo.
2. **Plan.** The planner writes the artifacts and returns a summary. The lead checks with `ls` that the files exist.
3. **Gate.** One stop for the user: spec, plan, unit table and the ship questions. The question tool takes at most four questions in one call, so plan for two calls: one for the approval, one for the ship questions.
4. **Dispatch.** The lead creates the unit worktrees, writes the ledger, starts the teammates with a brief.
5. **Build.** A teammate implements test-first, runs the polish gates, commits, reports one line with the full SHA.
6. **Verify.** The teammate or the verifier runs the full verify. The lead runs the spec compliance review and the security scan in parallel with it.
7. **Ship.** The lead sends `ship` with the stored answers. The teammate opens the pull request.
8. **Close.** One report, then the optional offers (deploy, bug bash) in one question call.

## Team check

Decide with numbers if a team pays off. Show the numbers at the gate.

- Minutes of a task: 0.15 for each step plus 0.2 for each file.
- A unit costs its task minutes plus `V`, the minutes of verify and ship. `V` depends on the stack. Measure it.
- `S` is the sum of the unit minutes. `C` is the largest sum along one chain of dependent units.
- The saving is `S - C`. Use the team when the saving is 8 minutes or more.
- Between 4 and 8 minutes, offer both ways at the gate and recommend the team.
- A task floor is useless: two independent one-task units can pass.

## Ledger

A plain file with one fact for each line. Never store a status word.

- Header: the stored gate answers, one line for each repo.
- One line for each unit at the start: unit, repo, branch, parent, start SHA.
- Later, append only: `<unit> <field>=<value>` for `assigned_at`, `owner`, `commit_sha`, `verdict=APPROVED@<sha>`, `fix_cycles`, `pr`, `parent_tip`, `note`.
- A verdict always carries the SHA it covers.

On resume, read the ledger and the facts of git and the code host. A fact wins over the ledger.

## Limits

A unit fails when it needs a fourth fix cycle or when it runs 45 minutes without an approved verdict. The work stays. The user chooses: raise the limit once, take over, or drop. Only the user changes a limit.

## Messages

- A teammate sends the lead only: the commit report, the verdict, the ship report, a question for the user, a `dispatch` request.
- The lead sends: `verify <unit>`, `ship <unit>`, `adjust <unit>: <request>`, `stop <unit>`, `free <task> base <sha>`.
- Peer signals between teammates use one format: `committed <task> <sha>`.
- A teammate has no question tool. A question goes to the lead, who batches the questions of several teammates.
- A teammate never starts a subagent. A step that needs a subagent becomes `dispatch <agent> unit <unit>`, and the lead runs it with the path of the unit worktree.

## What the lead must not do

- Edit code, specs or tests in a unit worktree.
- Resend a message because an idle notice crossed it. Read the ledger first.
- Ask the user a question and go on as if it was answered.
- Raise a limit by itself.
