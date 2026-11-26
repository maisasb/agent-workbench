# session-panel

A pane that lists every open Claude Code session on a machine and lets you act on them without entering each one. The pane text is in Brazilian Portuguese.

## What it does

- Groups sessions: needs you, done, working, waiting for something, and idle.
- Shows each session's title, the age of its state and the last paragraph it wrote.
- Opens the full message of a session (the text of the whole turn).
- Sends a message to a session without being in it.
- Approves or denies permission requests of other sessions from the pane. Today this covers only Bash commands that start with `echo panel-test`.
- Opens a session where it runs: the Claude desktop app, the VS Code extension, Herdr or cmux. The pane finds where each session lives. Herdr and cmux are optional.

## Use

- `/panel` opens the pane. `/panel-close` or `Esc` closes it.
- `/panel-list` prints the list in the chat.
- `/panel-read <n>` prints the full message of a session in the chat.
- `/panel-send <n> <text>` sends a message to a session.
- `/panel-open <n>` opens the session where it runs.
- `/panel-new <name>` starts a new session where the pane runs.
- `/panel-allow` and `/panel-deny` answer the oldest pending permission request.

The number of each session is next to its title in the pane.

## How it works

The pane reads `~/.claude/sessions/*.json` (the state of each session) and the end of each transcript in `~/.claude/projects/` (title and last message). It refreshes every 3 seconds. It sends messages with `$.session.send`. For approvals it writes requests and decisions in `~/.claude/panel/`.

## Requirements and limits

- Claude Code with mod support. The mod must be loaded in each session that receives approvals. Sessions opened before the install load it after a restart.
- `python3` on the PATH. The pane uses it to read the end of the transcripts.
- The pane sees only the sessions of the person who installs it, on the same machine.
- "Marcar como vista" clears the pane only. It does not change the "seen" state of Herdr or of the Claude app.
- Any process of the same user can write a decision file in `~/.claude/panel/decisions/`. Use the remote approval only as a test.
