# agent-team

A command that builds a feature with a team of Claude Code agents. The lead plans once, the user approves at one gate, and teammates build, verify and ship one pull request for each unit. Units of different repos run in parallel.

## Status

The design comes from many test rounds of a similar command. This generic version has not run end to end yet. Run it on a small task first, then use `agent-process` to analyze the round (`agent-test-round`).

## Use

```
claude --plugin-dir /path/to/agent-workbench/plugins/agent-team
```

Set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `~/.claude/settings.json` (`env`) first. Then, from a folder that holds the repos or from inside one repo:

```
/agent-team:feature <brief, or a link to a document with the tasks>
```

`--plugin-dir` works in the terminal only, not in the desktop app.

Add a `.agent-team.yml` to each repo to tell the command how to install, verify and where to put worktrees (`references/config.md`). Without it, the command asks.

## What is inside

| File | Role |
|---|---|
| `commands/feature.md` | The lead: the flow and the hard rules. |
| `references/pipeline.md` | The procedure of the lead, section by section. |
| `references/rules.md` | The rules of every teammate: git, locks, reports, messages. |
| `references/config.md` | The repo configuration and the repo record. |
| `references/compliance-review.md` | The prompt of the compliance reviewer. |
| `agents/team-planner.md` | Writes the spec, the plan and the tasks for all repos. |
| `agents/team-builder.md` | The teammate that builds, verifies and ships one unit. |
| `tools/depends-check.py` | Checks the `Depends on:` lines of `tasks.md`: unknown ID, self dependency, cross-repo dependency, cycle. |

## Limits of this version

- No security scan agent and no deploy steps. The lead runs any check that your repo wants after a commit, and the close offers a deploy step that you define.
- Git hosting is GitHub, through the `gh` command.
- Teammates have no question tool and no `Skill` tool in Claude Code today (`agent-process`, `claude-code-lessons.md`). The design routes every question through the lead.
