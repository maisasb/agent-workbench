---
description: Build a feature with a team of agents. The lead plans once, the user approves at one gate, and teammates build, verify and ship one pull request for each unit. Units of different repos run in parallel.
argument-hint: "<brief, or a link to a document with the tasks>"
---

# Build a feature with an agent team

You are the lead. Invoking this command is the opt-in to a team. The plan must pass the team check (`pipeline.md`, section 2), or you run the units yourself, one after the other.

Read `${CLAUDE_PLUGIN_ROOT}/references/pipeline.md` for the procedure and `${CLAUDE_PLUGIN_ROOT}/references/config.md` for the repo configuration. Read each section once, when you reach it.

Brief: $ARGUMENTS

plugin_root: `${CLAUDE_PLUGIN_ROOT}` (write this value in every brief and every planner input)

## Flow

0. **Resume.** When the brief starts with `resume <feature>`, go to `pipeline.md`, section 8, and skip step 1.
1. **Repos.** Split the brief into items by repo. Prepare one clean worktree for each repo, prove write access, run the login checks (`pipeline.md`, section 0).
2. **Plan.** Start `agent-team:team-planner` once for all repos. It writes the spec, the plan and the task list. Check that the files exist (section 1).
3. **Units and team check.** Build the units from the tasks. Compute the saving with the formulas of section 2. Decide: team, near miss, or sequence.
4. **Gate.** One stop for the user: summary, unit table, numbers of the team check, assumptions and open questions. Two `AskUserQuestion` calls at most in each pass (section 3).
5. **Dispatch.** Write the ledger, create the unit worktrees, start the teammates (`agent-team:team-builder`) with a brief each (section 4).
6. **Loop.** Handle commit reports, reviews, verdicts, limits and adjustments (section 5).
7. **Ship.** Send `ship` to the teammate of each approved unit. It pushes and opens the pull request (section 6).
8. **Close.** Report once, then offer the optional steps in one question call (section 7).

## Hard rules

- A unit is one card or story in one repo. Units of different repos are independent. A stack of pull requests stays inside one repo.
- You never edit code, specs or tests in a unit worktree, and you never commit for a unit. The exception is sequence mode (`pipeline.md`, section 2), where you build the units yourself.
- Teammates never start subagents and never ask the user a question. Both go through you.
- You ask the user only at these stops: the access and login question before the plan, the gate (two calls in each pass), a question or a diagnosis from a teammate, a failed verify, a check finding, a limit, and the close.
- Never raise a limit, delete a branch, close a pull request or kill a process on your own. Ask first.
- Write to the user in the language of the first message, from the first line to the last.
- One line for each verdict and each pull request. Nothing for an idle notice.
