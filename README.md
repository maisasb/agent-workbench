# agent-workbench

A personal marketplace for Claude Code. It holds a process to design, test and review agent workflows.

## Install

```
/plugin marketplace add <your-user>/agent-workbench
/plugin install agent-process@agent-workbench
/plugin install agent-team@agent-workbench
```

To try a plugin without a marketplace, clone the repo and start Claude Code from the terminal. `--plugin-dir` can repeat:

```
claude --plugin-dir /path/to/agent-workbench/plugins/agent-process --plugin-dir /path/to/agent-workbench/plugins/agent-team
```

The `--plugin-dir` flag works in the terminal only, not in the desktop app.

## Plugins

| Plugin | What it gives you |
|---|---|
| `agent-process` | Three skills, four reference files and two scripts. They cover test rounds of an agent workflow, consistency sweeps over instruction files, and design rules for agent teams. |
| `agent-team` | A runnable command, `/agent-team:feature`. A lead plans once, the user approves at one gate, and teammates build one pull request for each unit. Two agents, four reference files and one script. |

### Skills of `agent-process`

| Skill | Use it when |
|---|---|
| `agent-test-round` | You ran a test of an agent workflow and have a session id. It measures cost and time, separates the wait for the user, checks the new rules against the transcript, and decides pass or fail. |
| `agent-consistency-sweep` | You edited a command, its agents and its references, and you want to find conflicts and gaps before you commit. |
| `agent-team-design` | You design a command in which a lead agent splits work between teammates. |

### References

- `references/pattern.md`: the lead and teammates pattern, with the ledger, the gate and the limits.
- `references/testing-method.md`: how to run test rounds, how to compare them and when to commit.
- `references/claude-code-lessons.md`: behavior of Claude Code that shaped the design. Each item was observed at the time and can change.
- `references/findings.md`: failure patterns found in test rounds, written without any project detail.

### Scripts

- `tools/run-cost.py <session id>`: token cost for each agent of one session. It prints no message content.
- `tools/session-timeline.py <session id>`: agent starts, questions to the user with the wait time, and the active time of the run.

Both scripts read the local transcripts in `~/.claude/projects/`. Set `CLAUDE_PROJECTS_DIR` to read another folder.

## Add another plugin

1. Create `plugins/<name>/.claude-plugin/plugin.json` and the skills, agents or commands of the plugin.
2. Add an entry to `.claude-plugin/marketplace.json` with `name`, `description` and `source: "./plugins/<name>"`.
3. Run `claude plugin validate .` if your version has it, or load the plugin with `--plugin-dir` and check that it starts.

## License

MIT. See `LICENSE`.
