# Claude Code behavior that shaped the design

Each item was seen in test runs with Claude Code 2.1.308 in October 2026, unless it says it is a reading of the docs. Claude Code changes, so check an item again before you rely on it.

## Teammates and subagents

- Agent teams need `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and the `SendMessage` tool. The lead has the address `team-lead`.
- A teammate has no tool to ask the user a question and no `Skill` tool. A teammate reads a `SKILL.md` and does the work.
- A subagent that a teammate starts cannot hand its report back to the teammate. A subagent that the lead starts can.
- A subagent runs in the directory of the agent that started it. A subagent that a skill starts inside a teammate checked the tree of the lead and reported on the wrong code. The report looked right.
- A session can have `SendMessage` and lack `TaskCreate`, `TaskUpdate`, `TaskList` and `TaskGet`. Check each tool before the command depends on it.
- A message to a teammate arrives between its turns. A teammate in a long turn answers late. An idle notice can cross a message of the lead.

## Directories

- A teammate inherits the directories that the lead added with `/add-dir`.
- `Write` and `Edit` are denied outside those directories. `Bash` is not limited.
- A worktree for another repo must be inside an added directory.
- A session started in a folder that is not a git repo has no repo. Resolve the repo from the brief and `cd` into it.

## Loading a plugin

- `--plugin-dir` works in the terminal only, not in the desktop app.
- A tester needs a new pull of the plugin folder before each round.

## Transcripts and cost

- A session has a transcript in `~/.claude/projects/<project>/<session>.jsonl`.
- Subagents and teammates have their own transcripts in `<session>/subagents/agent-*.jsonl`, with a `.meta.json` file next to each.
- A message appears in more than one transcript. Count each `message.id` once.
- The cache read dominates the cost of a long lead session, because each turn rereads the whole context. In the runs, fewer lead turns mattered more than shorter lead text.
- A teammate that is idle loses its cache after a few minutes. A message to it costs a full read of its context.

## Hooks

- A hook that matches a phrase in a command can fire on a read-only command that only contains the phrase. Do not run a command that contains a trigger phrase of a hook unless you want the hook.

## Permissions

- A tool call that the user declines is a signal to stop and ask. Do not retry it in another form.
