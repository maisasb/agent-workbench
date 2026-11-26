import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Req, Sess } from '../types'

// Paths that depend on the machine. `initPaths` fills them at session.start.
const P = {
  home: '',
  sessions: '',
  seen: '',
  requests: '',
  decisions: '',
  loaded: '',
  newDir: '',
  herdr: 'herdr',
  cmux: '/Applications/cmux.app/Contents/Resources/bin/cmux',
}

const initPaths = async ($: any) => {
  const ran = await $.process.run(['printenv', 'HOME']).catch(() => undefined)
  const home = String(ran?.stdout ?? '').trim()
  if (home === '') return
  P.home = home
  P.sessions = `${home}/.claude/sessions`
  P.seen = `${home}/.claude/panel/seen`
  P.requests = `${home}/.claude/panel/requests`
  P.decisions = `${home}/.claude/panel/decisions`
  P.loaded = `${home}/.claude/panel/loaded`
  P.newDir = `${home}/workspace`
  // Herdr is optional: use its usual install path when it exists, else the PATH.
  const local = `${home}/.local/bin/herdr`
  if (await $.fs.exists(local).catch(() => false)) P.herdr = local
}
// Pink, so "needs you" never reads like "waiting", which uses the theme's warning color.
const NEEDS = '#ff5fa8'
const PANE = 'session-panel'
const READER = 'session-message'
// Wanted size of both panes: tall inline above the prompt, wide when docked.
const SIZE = { rows: 40, columns: 80 }
const WAIT_MS = 120_000
// A session that went idle this recently, after real work, counts as done.
const DONE_MS = 60 * 60_000
const MAX_AGE_MS = 10 * 60_000
// Test scope: only Bash commands starting with this text go through the panel.
const GATED_PREFIX = 'echo panel-test'

const sessions = atom({ plugin: 'session-panel', key: 'sessions' } as const, [], {
  shape: 'sessions-10',
})
const pending = atom({ plugin: 'session-panel', key: 'pending' } as const, [], {
  shape: 'pending-1',
})
const dismissed = atom({ plugin: 'session-panel', key: 'dismissed' } as const, {}, {
  shape: 'dismissed-1',
})
const replyTo = atom({ plugin: 'session-panel', key: 'replyTo' } as const, '', {
  shape: 'replyTo-1',
})
const reading = atom({ plugin: 'session-panel', key: 'reading' } as const, '', {
  shape: 'reading-1',
})

const paneOpen = atom({ plugin: 'session-panel', key: 'paneOpen' } as const, false, {
  shape: 'paneOpen-1',
})

// Whether the pane's own drawing has run since it last closed. A surface can seat
// the pane after `$.ui.open` resolved, so the drawing is the proof it is on screen.
let paneDrawn = false
// Whether the state already says so; drawing is pure, so a timer writes it.
let paneSet = false

// Opens the pane and remembers whether a surface draws it: the band above the
// prompt hides while it does.
const openPane = async ($: any, options: Record<string, unknown>) => {
  const placed: any = await $.ui
    .open({ id: PANE, title: 'Sessions', rows: SIZE.rows, columns: SIZE.columns, ...options })
    .catch(() => undefined)
  await update($, paneOpen, () => placed?.isPlaced === true)
}

// A plugin's own `$.ui.close` does not raise its own `ui.close` hook, so the
// state the band reads is set here too.
const closePane = async ($: any) => {
  await $.ui.close({ id: PANE }).catch(() => undefined)
  paneDrawn = false
  paneSet = false
  await update($, paneOpen, () => false)
}

const parse = (text: string): any => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const readAll = async ($: any, dir: string): Promise<any[]> => {
  const entries = await $.fs.list(dir).catch(() => [])
  const out: any[] = []
  for (const entry of entries) {
    if (!entry.name.endsWith('.json')) continue
    const text = await $.fs.read(`${dir}/${entry.name}`).catch(() => undefined)
    const value = text === undefined ? undefined : parse(text)
    if (value !== undefined) out.push(value)
  }
  return out
}


// Reads the tail of each transcript (they can exceed what $.fs.read allows)
// for the session's title and last prompt.
const DETAILS = `
import sys, json, glob, os, re, time, subprocess, shutil
ids = json.load(sys.stdin)
out = {}

def herdr(*args):
    try:
        run = subprocess.run([shutil.which("herdr") or os.path.expanduser("~/.local/bin/herdr"), *args], capture_output=True, text=True, timeout=5)
        return json.loads(run.stdout)["result"]
    except Exception:
        return {}

def cmux(*args):
    try:
        return subprocess.run(["/Applications/cmux.app/Contents/Resources/bin/cmux", *args], capture_output=True, text=True, timeout=5).stdout
    except Exception:
        return ""

# cmux: only workspaces the person named count; an automatic title says nothing.
cm_names = {}
try:
    for w in json.loads(cmux("--json", "list-workspaces")).get("workspaces", []):
        if w.get("has_custom_title") and w.get("custom_title"):
            cm_names[w["id"]] = w["custom_title"]
except Exception:
    pass
cm_space = {}
for line in cmux("sessions", "list").splitlines():
    found = re.match(r"claude (\S+)\s+workspace=(\S+)", line)
    if found and found.group(2) in cm_names:
        cm_space[found.group(1)] = cm_names[found.group(2)]

# Herdr marks an agent "done" until the person has looked at it: the finished-and-unseen signal.
agents = {
    (a.get("agent_session") or {}).get("value"): (
        a.get("agent_status", ""),
        a.get("completion_seq") or a.get("state_change_seq") or 0,
    )
    for a in herdr("agent", "list").get("agents", [])
}

# The Claude desktop app opens a session by its own local_ id; each record names the CLI session.
local = {}
for path in glob.glob(os.path.expanduser("~/Library/Application Support/Claude/claude-code-sessions/*/*/local_*.json")):
    try:
        record = json.load(open(path, encoding="utf-8", errors="ignore"))
        for key in ("cliSessionId", "lastAssistantCliSessionId"):
            if record.get(key):
                local[record[key]] = record["sessionId"]
    except Exception:
        pass

# When each session started, in local time, from the registry.
started = {}
for path in glob.glob(os.path.expanduser("~/.claude/sessions/*.json")):
    try:
        record = json.load(open(path))
        started[record["sessionId"]] = time.strftime("%H:%M", time.localtime(int(record["startedAt"]) / 1000))
    except Exception:
        pass

labels = {w["workspace_id"]: w.get("label", "") for w in herdr("workspace", "list").get("workspaces", [])}
space = {
    (p.get("agent_session") or {}).get("value"): labels.get(p["workspace_id"], "")
    for p in herdr("pane", "list").get("panes", [])
}
for sid in ids:
    if not re.fullmatch(r"[0-9a-f-]{36}", sid):
        continue
    found = glob.glob(os.path.expanduser("~/.claude/projects/*/" + sid + ".jsonl"))
    if not found:
        continue
    size = os.path.getsize(found[0])
    with open(found[0], "rb") as h:
        h.seek(max(0, size - 1200000))
        data = h.read().decode("utf-8", "ignore")
    quiet = int(time.time() - os.path.getmtime(found[0]))
    title = prompt = tool = ""
    turn = []
    for line in data.splitlines():
        if '"type":"user"' in line:
            try:
                d = json.loads(line)
            except Exception:
                continue
            if d.get("isMeta") or d.get("isSidechain"):
                continue
            content = (d.get("message") or {}).get("content")
            if isinstance(content, str):
                typed = content
            elif isinstance(content, list):
                typed = " ".join(
                    b.get("text", "") for b in content
                    if isinstance(b, dict) and b.get("type") == "text"
                )
            else:
                typed = ""
            # A new prompt from the person starts a new turn; tool results and
            # hook feedback do not.
            if typed.strip() and not typed.lstrip().startswith(("Stop hook", "<")):
                turn = []
            continue
        if '"type":"assistant"' in line:
            try:
                d = json.loads(line)
            except Exception:
                continue
            if d.get("isSidechain"):
                continue
            blocks = (d.get("message") or {}).get("content")
            if isinstance(blocks, list):
                for b in blocks:
                    if isinstance(b, dict) and b.get("type") == "tool_use":
                        inp = b.get("input") or {}
                        tool = (b.get("name", "") + ": " + str(inp.get("description") or inp.get("command") or ""))[:80]
                text = "\\n".join(
                    b.get("text", "") for b in blocks
                    if isinstance(b, dict) and b.get("type") == "text"
                ).strip()
                if text:
                    turn.append(text)
            continue
        if '"ai-title"' in line or '"last-prompt"' in line:
            try:
                d = json.loads(line)
            except Exception:
                continue
            if d.get("type") == "ai-title":
                title = d.get("aiTitle") or title
            elif d.get("type") == "last-prompt":
                prompt = d.get("lastPrompt") or prompt
    out[sid] = {"title": title, "prompt": prompt, "said": "\\n\\n".join(turn)[-8000:], "quiet": quiet, "tool": " ".join(tool.split()), "ws": space.get(sid) or cm_space.get(sid, ""), "hstatus": agents.get(sid, ("", 0))[0], "seq": agents.get(sid, ("", 0))[1], "local": local.get(sid, ""), "started": started.get(sid, "")}
print(json.dumps(out))
`

const details = async ($: any, ids: string[]): Promise<Record<string, any>> => {
  const ran = await $.process
    .run(['python3', '-I', '-c', DETAILS], { stdin: JSON.stringify(ids), timeoutMs: 10000 })
    .catch(() => undefined)
  return (ran && ran.exitCode === 0 && parse(ran.stdout)) || {}
}

const refresh = async ($: any) => {
  const now = await $.clock.now()
  const found: Sess[] = (await readAll($, P.sessions)).map(s => ({
    name: String(s.name),
    status: String(s.status),
    cwd: String(s.cwd),
    sessionId: String(s.sessionId),
    since: Number(s.statusUpdatedAt),
    title: '',
    prompt: '',
    said: '',
    quiet: 0,
    lastTool: '',
    pid: Number(s.pid),
    ws: '',
    entry: String(s.entrypoint ?? ''),
    hstatus: '',
    seq: 0,
    local: '',
    started: '',
    dup: false,
  }))
  const extra = await details($, found.map(s => s.sessionId))
  for (const s of found) {
    s.title = extra[s.sessionId]?.title ?? ''
    s.prompt = extra[s.sessionId]?.prompt ?? ''
    s.said = extra[s.sessionId]?.said ?? ''
    s.quiet = Number(extra[s.sessionId]?.quiet ?? 0)
    s.lastTool = extra[s.sessionId]?.tool ?? ''
    s.ws = extra[s.sessionId]?.ws ?? ''
    s.hstatus = extra[s.sessionId]?.hstatus ?? ''
    s.seq = Number(extra[s.sessionId]?.seq ?? 0)
    s.local = extra[s.sessionId]?.local ?? ''
    s.started = extra[s.sessionId]?.started ?? ''
  }
  // Two sessions with the same name (a fork keeps its parent's title) get the
  // time they started appended, so they can be told apart.
  const count: Record<string, number> = {}
  for (const s of found) count[s.title || s.name] = (count[s.title || s.name] ?? 0) + 1
  for (const s of found) s.dup = (count[s.title || s.name] ?? 0) > 1
  const decided = new Set<string>()
  for (const entry of await $.fs.list(P.decisions).catch(() => [])) {
    decided.add(entry.name.replace(/\.json$/, ''))
  }
  const requests: Req[] = (await readAll($, P.requests)).filter(
    r => !decided.has(String(r.id)) && now - Number(r.at) < MAX_AGE_MS,
  )
  const seen: Record<string, number> = {}
  for (const mark of await readAll($, P.seen)) seen[String(mark.sessionId)] = Number(mark.key)
  await update($, dismissed, () => seen)
  await update($, sessions, () => found)
  await update($, pending, () => requests)
}

// Seconds without a transcript write after which a busy session counts as waiting.
const QUIET_S = 120

// What a "seen" mark is stored against: a new completion makes the session new again.
const seenKey = (s: Sess): number => (s.seq > 0 ? s.seq : s.since)

type Groups = { waiting: Sess[]; working: Sess[]; blocked: Sess[]; done: Sess[]; idle: Sess[] }

const group = (
  list: Sess[],
  seen: Record<string, number>,
  now: number,
  mine: string,
): Groups => {
  const waiting = list.filter(s => s.status === 'waiting')
  const isBlocked = (s: Sess) => s.status === 'shell' || (s.status === 'busy' && s.quiet > QUIET_S)
  const blocked = list.filter(s => isBlocked(s) && !waiting.includes(s))
  const working = list.filter(s => s.status === 'busy' && !isBlocked(s))
  const rest = list.filter(s => !waiting.includes(s) && !blocked.includes(s) && !working.includes(s))
  const done = rest
    .filter(
      s =>
        s.sessionId !== mine &&
        seen[s.sessionId] !== seenKey(s) &&
        // A fork keeps its parent's title: the parent, once a newer session
        // carries on its conversation, is not "done" any more.
        !list.some(o => o !== s && o.title !== '' && o.title === s.title && o.since > s.since) &&
        // In Herdr, "done" means finished and not yet looked at. Elsewhere, a
        // session that went idle recently after real work.
        (s.hstatus !== '' ? s.hstatus === 'done' : s.prompt !== '' && now - s.since < DONE_MS),
    )
    .sort((a, b) => b.since - a.since)
  const idle = rest.filter(s => !done.includes(s)).sort((a, b) => b.since - a.since)

  return { waiting, working, blocked, done, idle }
}

// The number shown beside each session, and what /panel-send and /panel-read take.
const order = (g: Groups): Sess[] => [...g.waiting, ...g.done, ...g.working, ...g.blocked, ...g.idle]

const snapshot = async ($: any) => {
  const list = await read($, sessions)
  const seen = await read($, dismissed)
  const g = group(list, seen, await $.clock.now(), await $.session.id())

  return order(g)
}

// Brings the session's terminal to the front. Herdr lists each pane with the
// Claude session id it runs; cmux lists each session with its workspace and
// surface. A session in neither has no terminal this mod can reach.
const openSession = async ($: any, s: Sess): Promise<string> => {
  const run = (argv: string[]) => $.process.run(argv, { timeoutMs: 8000 }).catch(() => undefined)
  const name = nameOf(s)

  // Sessions of the Claude desktop app and the VS Code extension open by URL.
  if (s.entry === 'claude-desktop' && s.local === '') {
    return 'Não achei o ID desta sessão no app Claude desktop.'
  }
  const ide =
    s.entry === 'claude-desktop'
      ? `claude://code/continue?session=${s.local}`
      : s.entry.includes('vscode')
        ? `vscode://anthropic.claude-code/open?session=${s.sessionId}`
        : undefined
  if (ide) {
    const ran = await run(['open', ide])
    await markSeen($, s)

    return ran?.exitCode === 0
      ? `Pedi ao app para abrir: ${name}`
      : `Não consegui abrir: ${String(ran?.stderr || 'sem resposta').slice(0, 120)}`
  }

  const listed = await run([P.herdr, 'pane', 'list'])
  const panes: any[] = (listed?.exitCode === 0 && parse(listed.stdout)?.result?.panes) || []
  const pane = panes.find(x => x.agent_session?.value === s.sessionId)
  if (pane) {
    let ran = await run([P.herdr, 'agent', 'focus', pane.pane_id])
    if (ran?.exitCode !== 0) ran = await run([P.herdr, 'workspace', 'focus', pane.workspace_id])

    await markSeen($, s)

    return ran?.exitCode === 0
      ? `Aberta no Herdr: ${name}`
      : `Herdr não abriu: ${String(ran?.stderr || 'sem resposta').slice(0, 120)}`
  }

  const cm = await run([P.cmux, 'sessions', 'list'])
  const row = String(cm?.stdout ?? '')
    .split('\n')
    .find(line => line.includes(s.sessionId))
  const workspace = row?.match(/workspace=(\S+)/)?.[1]
  const surface = row?.match(/surface=(\S+)/)?.[1]
  if (workspace && surface) {
    await run([P.cmux, 'select-workspace', '--workspace', workspace])
    const ran = await run([P.cmux, 'focus-panel', '--panel', surface, '--workspace', workspace])
    await markSeen($, s)

    return ran?.exitCode === 0
      ? `Aberta no cmux: ${name}`
      : `cmux não abriu: ${String(ran?.stderr || ran?.stdout || 'sem resposta').slice(0, 120)}`
  }

  return `Sem terminal para abrir: não está nos ${panes.length} panes do Herdr nem no cmux.`
}

// The name shown for a session: the Herdr workspace the person named, then what
// the session is about.
const baseName = (s: Sess): string => {
  const about = s.title || s.name

  return s.ws !== '' && s.ws !== about ? `${s.ws} - ${about}` : about
}

const suffixOf = (s: Sess): string => (s.dup && s.started !== '' ? ` · iniciada ${s.started}` : '')

const nameOf = (s: Sess): string => `${baseName(s)}${suffixOf(s)}`

// The name cut to `room` characters, keeping the suffix that tells twins apart.
const fitName = (s: Sess, room: number): string => {
  const suffix = suffixOf(s)
  const base = baseName(s)
  const space = Math.max(8, room - suffix.length)

  return `${base.length > space ? `${base.slice(0, space - 1)}…` : base}${suffix}`
}

// Starts a new Claude session where the panel runs: the desktop app for a
// session of the app, else the Herdr or cmux the panel's own session lives in.
const newSession = async ($: any, typed = ''): Promise<string> => {
  const label = typed.trim().slice(0, 60) || 'nova sessão'
  const agentName = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'nova-sessao'
  const run = (argv: string[], ms = 10000) =>
    $.process.run(argv, { timeoutMs: ms }).catch(() => undefined)
  const here = (await read($, sessions)).find(x => x.sessionId === undefined)
  const mine = await $.session.id()
  const me = (await read($, sessions)).find(x => x.sessionId === mine) ?? here

  if (me?.entry === 'claude-desktop') {
    const ran = await run(['open', `claude://code/new?folder=${encodeURIComponent(P.newDir)}`])

    return ran?.exitCode === 0
      ? 'Pedi ao app para abrir uma sessão nova. O app dá o nome sozinho.'
      : 'O app não abriu a sessão nova.'
  }
  if (me?.entry.includes('vscode')) {
    return 'No VS Code, abra a sessão nova pelo botão + da extensão.'
  }

  const listed = await run([P.herdr, 'pane', 'list'])
  const panes: any[] = (listed?.exitCode === 0 && parse(listed.stdout)?.result?.panes) || []
  const inHerdr = panes.some(x => x.agent_session?.value === mine)
  const cm = await run([P.cmux, 'sessions', 'list'])
  const inCmux = !inHerdr && String(cm?.stdout ?? '').includes(mine)

  if (inCmux) {
    const ran = await run([P.cmux, 'new-workspace', '--name', label, '--cwd', P.newDir, '--command', 'claude'])

    return ran?.exitCode === 0 ? 'Sessão nova aberta no cmux.' : `O cmux não abriu: ${String(ran?.stderr || '').slice(0, 100)}`
  }

  // Herdr: also the fallback where the panel's host is unknown.
  const created = await run([P.herdr, 'workspace', 'create', '--cwd', P.newDir, '--label', label, '--no-focus'])
  const info = created?.exitCode === 0 ? parse(created.stdout)?.result : undefined
  const pane = info?.root_pane?.pane_id
  const workspace = info?.workspace?.workspace_id
  if (!pane) return 'O Herdr não criou o workspace.'
  const started = await run([P.herdr, 'agent', 'start', agentName, '--kind', 'claude', '--pane', pane, '--timeout', '40000'], 60000)
  if (started?.exitCode !== 0) {
    return `O Herdr criou o workspace, mas não iniciou o Claude: ${String(started?.stderr || '').slice(0, 100)}`
  }
  await run([P.herdr, 'workspace', 'focus', workspace])

  return 'Sessão nova aberta no Herdr.'
}

const markSeen = async ($: any, s: Sess) => {
  await $.fs.write(`${P.seen}/${s.sessionId}.json`, JSON.stringify({ sessionId: s.sessionId, key: seenKey(s) }))
  await update($, dismissed, m => ({ ...m, [s.sessionId]: seenKey(s) }))
}

const pick = (all: Sess[], text: string): Sess | undefined => all[Number(text) - 1]

const ORDER: Record<string, number> = { waiting: 0, busy: 1, shell: 2, idle: 3 }

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await initPaths($)
    // Marker that tells where the mod loaded: one file per session start.
    void (async () => {
      const id = await $.session.id()
      await $.fs.write(
        `${P.loaded}/${id}.json`,
        JSON.stringify({ sessionId: id, surface: (e as any).surface ?? 'unknown', at: await $.clock.now() }),
      )
    })().catch(() => undefined)
    await $.command.register({
      name: 'panel',
      description: 'Show the open Claude Code sessions in a pane',
    })
    await $.command.register({
      name: 'panel-close',
      description: 'Close the sessions pane',
    })
    const commands: [string, string][] = [
      ['panel-send', 'Send a message to a session: /panel-send <number> <text>'],
      ['panel-new', 'Start a new Claude session where this panel runs: /panel-new <name>'],
      ['panel-open', 'Bring a session to the front in Herdr: /panel-open <number>'],
      ['panel-list', 'Print every session with its last message, in full width'],
      ['panel-read', 'Print the last message of a session: /panel-read <number>'],
      ['panel-allow', 'Allow the oldest pending approval'],
      ['panel-deny', 'Deny the oldest pending approval'],
    ]
    for (const [name, description] of commands) {
      await $.command.register({ name, description })
    }
    void openPane($, { placement: 'widget' })
    void refresh($)
    $.clock.every(3000, () => void refresh($))
    $.clock.every(500, () => {
      if (paneDrawn && !paneSet) {
        paneSet = true
        void update($, paneOpen, () => true)
      }
    })

    return next(e)
  })

  on('command.run', { command: 'panel' }, async $ => {
    await openPane($, { focus: true, closeOnEscape: true })

    return { text: 'Sessions pane opened.' }
  })

  on('command.run', { command: 'panel-send' }, async ($, e) => {
    const [number, ...words] = e.args.trim().split(/\s+/)
    const target = pick(await snapshot($), number ?? '')
    const text = words.join(' ')
    if (!target) return { text: 'Use: /panel-send <number> <text>. The numbers are in the panel.' }
    if (text === '') return { text: 'Write the message after the number.' }
    const sent: any = await $.session
      .send({ to: { sessionId: target.sessionId }, text })
      .catch((err: unknown) => ({ deny: String(err) }))

    return { text: sent?.deny ? `Not sent: ${sent.deny}` : `Sent to ${nameOf(target)}.` }
  })

  on('command.run', { command: 'panel-new' }, async ($, e) => ({ text: await newSession($, e.args) }))

  on('command.run', { command: 'panel-open' }, async ($, e) => {
    const target = pick(await snapshot($), e.args.trim())
    if (!target) return { text: 'Use: /panel-open <number>. The numbers are in the panel.' }

    return { text: await openSession($, target) }
  })

  on('command.run', { command: 'panel-list' }, async $ => {
    const list = await read($, sessions)
    const g = group(list, await read($, dismissed), await $.clock.now(), await $.session.id())
    const all = order(g)
    const sections: [string, Sess[]][] = [
      ['Precisa de você', g.waiting],
      ['Concluídas', g.done],
      ['Em andamento', g.working],
      ['Aguardando algo', g.blocked],
      ['Paradas', g.idle],
    ]
    const lines: string[] = []
    for (const [name, items] of sections) {
      if (items.length === 0) continue
      lines.push(`\n${name} (${items.length})`)
      for (const s of items) {
        const said = s.said.replace(/\s+/g, ' ')
        lines.push(`${all.indexOf(s) + 1}. ${nameOf(s)}`)
        if (said !== '') lines.push(`   ${said.length > 300 ? `${said.slice(0, 299)}…` : said}`)
      }
    }

    return { text: lines.join('\n').trim() || 'No sessions found.' }
  })

  on('command.run', { command: 'panel-read' }, async ($, e) => {
    const target = pick(await snapshot($), e.args.trim())
    if (!target) return { text: 'Use: /panel-read <number>. The numbers are in the panel.' }

    return { text: `${nameOf(target)}\n\n${target.said || 'No message yet.'}` }
  })

  for (const decision of ['allow', 'deny'] as const) {
    on('command.run', { command: `panel-${decision}` }, async $ => {
      const [first] = [...(await read($, pending))].sort((a, b) => a.at - b.at)
      if (!first) return { text: 'No pending approval.' }
      await $.fs.write(`${P.decisions}/${first.id}.json`, JSON.stringify({ decision }))
      await update($, pending, l => l.filter(r => r.id !== first.id))

      return { text: `${decision === 'allow' ? 'Allowed' : 'Denied'}: ${first.summary}` }
    })
  }

  on('command.run', { command: 'panel-close' }, async $ => {
    await $.ui.close({ id: READER }).catch(() => undefined)
    await closePane($)

    return { text: 'Sessions panes closed.' }
  })

  // Gated test: ask the panel, wait for the person's click, else fall back to
  // the normal dialog.
  on('tool.check', { tool: 'Bash' }, async ($, e, next) => {
    const command = String((e.input as { command?: string }).command ?? '')
    if (!command.startsWith(GATED_PREFIX)) return next(e)

    const id = e.tool_use_id ?? String(await $.clock.now())
    const request: Req = {
      id,
      sessionId: await $.session.id(),
      tool: 'Bash',
      summary: command.slice(0, 200),
      at: await $.clock.now(),
    }
    await $.fs.write(`${P.requests}/${id}.json`, JSON.stringify(request))

    const deadline = request.at + WAIT_MS
    while ((await $.clock.now()) < deadline) {
      const text = await $.fs.read(`${P.decisions}/${id}.json`).catch(() => undefined)
      const verdict = text === undefined ? undefined : parse(text)?.decision
      if (verdict === 'allow') return { decision: 'allow', reason: 'approved in the session panel' }
      if (verdict === 'deny') return { decision: 'deny', reason: 'denied in the session panel' }
      await $.clock.sleep(500, { signal: next.signal })
    }

    return { decision: 'ask', reason: 'the session panel got no answer in time' }
  }).catch(($, e, next) => next(e))

  // A one-row band above the prompt: how many sessions need you and the oldest one.
  // The person collapses it with the engine's own control; pressing the button opens the pane.
  on('ui.close', async ($, e, next) => {
    const closed = await next(e)
    if (e.id === PANE) {
      paneDrawn = false
      paneSet = false
      await update($, paneOpen, () => false)
    }

    return closed
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // The pane already shows everything the band does.
    if (await read($, paneOpen)) return next(e)
    const list = await read($, sessions)
    if (e.props.hasSurvey) return next(e)
    if (list.length === 0) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const now = await $.clock.now()
    const requests = [...(await read($, pending))].sort((a, b) => a.at - b.at)
    const g = group(list, await read($, dismissed), now, await $.session.id())
    const needs = requests.length + g.waiting.length
    const oldest = [...g.waiting].sort((a, b) => a.since - b.since)[0]
    const owner = requests[0] ? list.find(x => x.sessionId === requests[0]?.sessionId) : undefined
    const fit = (text: string) => (text.length > 60 ? `${text.slice(0, 59)}…` : text)
    const ago = (ms: number) => {
      const m = Math.max(0, Math.round((now - ms) / 60000))
      return m < 60 ? `${m}m` : `${Math.round(m / 60)}h`
    }
    const count = (n: number, word: string) => `${n} ${word}`
    // The chip carries the state that most needs a look; the text carries the rest.
    const lead =
      needs > 0
        ? { text: `${needs} ${needs === 1 ? 'PRECISA' : 'PRECISAM'} DE VOCÊ`, color: NEEDS, key: 'needs' }
        : g.done.length > 0
          ? { text: `${g.done.length} ${g.done.length === 1 ? 'CONCLUÍDA' : 'CONCLUÍDAS'}`, color: 'suggestion', key: 'done' }
          : g.working.length > 0
            ? { text: `${g.working.length} EM ANDAMENTO`, color: 'success', key: 'working' }
            : g.blocked.length > 0
              ? { text: `${g.blocked.length} AGUARDANDO`, color: 'warning', key: 'blocked' }
              : undefined
    const rest = [
      lead?.key !== 'working' && g.working.length > 0 ? count(g.working.length, 'em andamento') : '',
      lead?.key !== 'blocked' && g.blocked.length > 0 ? count(g.blocked.length, 'aguardando') : '',
      lead?.key !== 'done' && g.done.length > 0 ? count(g.done.length, g.done.length === 1 ? 'concluída' : 'concluídas') : '',
    ]
      .filter(Boolean)
      .join(' · ')
    const head =
      requests[0] !== undefined
        ? `${fit(owner ? nameOf(owner) : 'pedido')} · ${requests[0].tool}: ${fit(requests[0].summary)} · ${ago(requests[0].at)}`
        : oldest
          ? `${fit(nameOf(oldest))} · ${ago(oldest.since)}`
          : [lead?.key === 'done' ? g.done[0] : lead?.key === 'working' ? g.working[0] : lead?.key === 'blocked' ? g.blocked[0] : undefined]
              .map(first => [first ? fit(nameOf(first)) : '', rest].filter(Boolean).join(' · '))[0] || 'nada novo'

    // One line. The cockpit band is three elements; this one adds a button. If the
    // band stops drawing, a row past the band's limits is the first suspect.
    const columns = Number((e.props as any).bodyColumns) || 80
    const label = lead ? ` ${lead.text} ` : ''
    const action = 'abrir painel'
    const room = Math.max(10, columns - 'painel'.length - 1 - (label ? label.length + 1 : 0) - action.length - 1)
    const line = head.length > room ? `${head.slice(0, room - 1)}…` : head

    return (
      <Box flexDirection="row" gap={1} marginTop={1}>
        <Text color={lead?.color} bold>painel</Text>
        {label !== '' && (
          <Text color="inverseText" backgroundColor={lead?.color} bold>{label}</Text>
        )}
        <Text>{line}</Text>
        <Button key="band-open" plain onPress={() => openPane($, { focus: true, closeOnEscape: true })}>
          {action}
        </Button>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    // Drawn means placed. Drawing is pure, so only a variable is set here; a timer
    // turns it into state.
    paneDrawn = true
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, sessions)
    const requests = await read($, pending)
    const seen = await read($, dismissed)
    const flat = (text: string) => text.replace(/\s+/g, ' ')
    const mine = await $.session.id()
    const now = await $.clock.now()
    const room = Number((e.props as any).bodyColumns) || e.viewport?.columns || 80
    // `room` is the pane body's own width, so only a small margin is kept.
    // Outside the terminal the text is drawn in a proportional font: an average
    // character is narrower than a cell, so more of them fit in the same columns.
    const scale = (e as any).surface === 'terminal' ? 1 : 1.2
    const width = Math.min(140, Math.max(30, Math.floor((room - 2) * scale)))
    const cut = (text: string, room = width) =>
      text.length > room ? `${text.slice(0, room - 1)}…` : text
    const age = (ms: number) => {
      const m = Math.max(0, Math.round((now - ms) / 60000))
      return m < 60 ? `${m}m` : `${Math.round(m / 60)}h`
    }
    const label = nameOf
    const { waiting, working, blocked, done, idle } = group(list, seen, now, mine)
    const numberOf = (s: Sess) => order({ waiting, working, blocked, done, idle }).indexOf(s) + 1
    // The small form (desktop widget): the counts only.
    if ((e.props as any).placement === 'widget') {
      const needsNow = requests.length + waiting.length

      return (
        <Box flexDirection="column">
          <Text bold color={needsNow > 0 ? NEEDS : undefined}>{needsNow} precisam de você</Text>
          <Text dimColor>
            {working.length} em andamento · {blocked.length} aguardando · {done.length} concluídas
          </Text>
        </Box>
      )
    }
    const why = (s: Sess) =>
      s.status === 'shell'
        ? 'processo em segundo plano'
        : `sem atividade há ${Math.round(s.quiet / 60)}m${s.lastTool ? ` · ${s.lastTool}` : ''}`

    const decide = (id: string, decision: 'allow' | 'deny') => async () => {
      await $.fs.write(`${P.decisions}/${id}.json`, JSON.stringify({ decision }))
      await update($, pending, l => l.filter(r => r.id !== id))
    }
    const read_ = (s: Sess) => async () => {
      $.ui.toast('Abrindo a mensagem completa…')
      await update($, reading, () => s.sessionId)
      await $.ui.open({ id: READER, title: label(s), focus: true, closeOnEscape: true, rows: SIZE.rows, columns: SIZE.columns })
    }
    // Pressing a session puts "/panel-send <number> " in the main prompt: the
    // person types the message there. This avoids a text field inside the pane.
    const open = (s: Sess) => async () => {
      $.ui.toast(await openSession($, s))
    }
    const reply = (s: Sess) => async () => {
      const filled: any = await $.prompt.fill({ text: `/panel-send ${numberOf(s)} ` })
      $.ui.toast(
        filled?.isFilled === false
          ? 'Não consegui preencher o prompt.'
          : 'Prompt preenchido. Esc volta ao prompt: digite a mensagem e dê Enter.',
      )
    }
    // The full message is offered when the short one is cut, and not while the
    // session is still working: its message is about to change.
    const canRead = (s: Sess) =>
      !working.includes(s) && (flat(s.said).length > (width - 4) * 2 || s.said.includes('\n\n'))
    // Text columns inside a bordered card: the border and the padding take 4.
    const inner = width - 4
    // A session as a bordered card: title and age on one line,
    // the last paragraph the session wrote, then its actions.
    const card = (s: Sess, color: string, extra?: any) => (
      <Box key={s.sessionId} flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
        <Box justifyContent="space-between">
          <Text color={color} bold>
            ◆ {numberOf(s)}. {fitName(s, inner - 12)}
            {s.sessionId === mine ? ' (esta sessão)' : ''}
          </Text>
          <Text dimColor>{age(s.since)}</Text>
        </Box>
        {blocked.includes(s) && <Text color="warning">⏳ {cut(why(s), inner - 3)}</Text>}
        {s.said !== '' ? (
          <Text dimColor>{cut(flat(s.said.split(/\n{2,}/).filter(Boolean).at(-1) ?? ''), inner * 2)}</Text>
        ) : (
          s.prompt !== '' && <Text dimColor>Você: {cut(s.prompt, inner - 6)}</Text>
        )}
        <Box flexWrap="wrap" gap={1} marginTop={1}>
          {s.sessionId !== mine && !working.includes(s) && (
            <Button key={`pick-${s.sessionId}`} onPress={reply(s)}>
              Responder
            </Button>
          )}
          {canRead(s) && (
            <Button key={`read-${s.sessionId}`} onPress={read_(s)}>
              Ler mensagem
            </Button>
          )}
          {s.sessionId !== mine && (
            <Button key={`open-${s.sessionId}`} onPress={open(s)}>
              ↗ Abrir sessão
            </Button>
          )}
          {extra}
        </Box>
      </Box>
    )
    const section = (title: string, color: string, note: string, children: any) => (
      <Box flexDirection="column">
        <Box justifyContent="space-between">
          <Text bold color={color}>{title}</Text>
          <Text dimColor>{note}</Text>
        </Box>
        {children}
      </Box>
    )
    const needs = requests.length + waiting.length

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Box justifyContent="space-between">
            <Text bold>PAINEL</Text>
            <Text dimColor>/panel-close</Text>
          </Box>
          <Text>
            <Text color={needs > 0 ? NEEDS : undefined} bold={needs > 0}>{needs} precisam de você</Text>
            <Text dimColor> · </Text>
            <Text color={blocked.length > 0 ? 'warning' : undefined}>{blocked.length} aguardando</Text>
            <Text dimColor> · </Text>
            <Text color={working.length > 0 ? 'success' : undefined}>{working.length} em andamento</Text>
            <Text dimColor> · </Text>
            <Text color={done.length > 0 ? 'suggestion' : undefined}>{done.length} concluídas</Text>
            <Text dimColor> · {idle.length} paradas</Text>
          </Text>
        </Box>
        <Box gap={1}>
          <Button key="minimize" onPress={() => closePane($)}>
            − Minimizar
          </Button>
          <Button
            key="new-session"
            onPress={async () => {
              await $.prompt.fill({ text: '/panel-new ' })
              $.ui.toast('Digite o nome da sessão e dê Enter. Sem nome, usa "nova sessão".')
            }}
          >
            + Nova sessão
          </Button>
        </Box>
        {needs > 0 &&
          section(
            `PRECISA DE VOCÊ · ${needs}`,
            NEEDS,
            'pedidos primeiro · mais antigos primeiro',
            <Box flexDirection="column" gap={1}>
              {requests.map((r, n) => {
                const owner = list.find(x => x.sessionId === r.sessionId)
                return (
                  <Box key={`req-${r.id}`} flexDirection="column" borderStyle="round" borderColor={NEEDS} paddingX={1}>
                    <Text bold>{cut(owner ? label(owner) : r.sessionId.slice(0, 8), inner)}</Text>
                    <Text>{cut(`${r.tool}: ${r.summary}`, inner)}</Text>
                    <Box gap={1}>
                      <Button key={`allow-${r.id}`} hotkey={n === 0 ? 'y' : undefined} onPress={decide(r.id, 'allow')}>
                        Permitir{n === 0 ? ' (y)' : ''}
                      </Button>
                      <Button key={`deny-${r.id}`} hotkey={n === 0 ? 'n' : undefined} onPress={decide(r.id, 'deny')}>
                        Negar{n === 0 ? ' (n)' : ''}
                      </Button>
                    </Box>
                  </Box>
                )
              })}
              {waiting.map(s => card(s, NEEDS))}
            </Box>,
          )}
        {done.length > 0 &&
          section(
            `CONCLUÍDAS · ${done.length}`,
            'suggestion',
            'terminaram e você ainda não viu',
            <Box flexDirection="column" gap={1}>
              {done.map(s =>
                card(
                  s,
                  'suggestion',
                  <Button key={`ok-${s.sessionId}`} onPress={() => markSeen($, s)}>
                    Marcar como vista
                  </Button>,
                ),
              )}
            </Box>,
          )}
        {working.length > 0 &&
          section(
            `EM ANDAMENTO · ${working.length}`,
            'success',
            'trabalhando agora',
            <Box flexDirection="column" gap={1}>{working.map(s => card(s, 'success'))}</Box>,
          )}
        {blocked.length > 0 &&
          section(
            `AGUARDANDO ALGO · ${blocked.length}`,
            'warning',
            'não estão trabalhando',
            <Box flexDirection="column" gap={1}>{blocked.map(s => card(s, 'inactive'))}</Box>,
          )}
        {section(
          `PARADAS · ${idle.length}`,
          'inactive',
          'Enter preenche /panel-send',
          <Box flexDirection="column" borderStyle="round" borderColor="inactive" paddingX={1}>
            {idle.map(s => (
              <Box key={`idle-${s.sessionId}`} justifyContent="space-between">
                {s.sessionId === mine ? (
                  <Text dimColor>{numberOf(s)}. {fitName(s, Math.max(8, inner - 22))} (esta sessão)</Text>
                ) : (
                  <Box>
                    <Button key={`pick-${s.sessionId}`} plain onPress={reply(s)}>
                      <Text dimColor>{numberOf(s)}. {fitName(s, Math.max(8, inner - 16))}</Text>
                    </Button>
                    <Button key={`open-${s.sessionId}`} plain onPress={open(s)}>
                      {' ↗ abrir'}
                    </Button>
                  </Box>
                )}
                <Text dimColor>{age(s.since)}</Text>
              </Box>
            ))}
          </Box>,
        )}
        <Box flexDirection="column">
          <Text bold dimColor>COMANDOS</Text>
          <Text dimColor>/panel-send &lt;nº&gt; &lt;texto&gt;  envia mensagem à sessão</Text>
          <Text dimColor>/panel-new &lt;nome&gt;  inicia uma sessão nova onde o painel roda</Text>
          <Text dimColor>/panel-open &lt;nº&gt;  abre a sessão</Text>
          <Text dimColor>/panel-list  lista tudo no chat, em largura total</Text>
          <Text dimColor>/panel-read &lt;nº&gt;  mostra a mensagem completa no chat</Text>
          <Text dimColor>/panel-allow · /panel-deny  aprova ou nega o pedido</Text>
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: READER }, async ($, e) => {
    const { Box, Text, Markdown, Button } = $.ui.resolve(e)
    const which = await read($, reading)
    const all = await snapshot($)
    const index = all.findIndex(x => x.sessionId === which)
    const found = all[index]
    const number = index + 1
    const reply = async () => {
      const filled: any = await $.prompt.fill({ text: `/panel-send ${number} ` })
      $.ui.toast(
        filled?.isFilled === false
          ? 'Não consegui preencher o prompt.'
          : 'Prompt preenchido. Esc volta ao prompt: digite a mensagem e dê Enter.',
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>{found ? `${number}. ${nameOf(found)}` : 'Sessão não encontrada'}</Text>
        <Markdown text={found?.said || 'Esta sessão ainda não escreveu nada.'} />
        {found && (
          <Box>
            <Button key="reader-reply" onPress={reply}>
              Responder a esta sessão
            </Button>
            <Button key="reader-open" onPress={async () => $.ui.toast(await openSession($, found))}>
              Abrir esta sessão
            </Button>
            <Button key="reader-close" onPress={() => $.ui.close({ id: READER })}>
              Fechar
            </Button>
          </Box>
        )}
        {found && <Text dimColor>/panel-send {number} &lt;texto&gt;  ·  Esc fecha</Text>}
      </Box>
    )
  })
}
