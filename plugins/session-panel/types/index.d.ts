export type Sess = { name: string; status: string; cwd: string; sessionId: string; since: number; title: string; prompt: string; said: string; quiet: number; lastTool: string; pid: number; ws: string; entry: string; hstatus: string; seq: number; local: string; started: string; dup: boolean }
export type Req = { id: string; sessionId: string; tool: string; summary: string; at: number }

declare module 'claude-code' {
  interface PluginState {
    'session-panel': { sessions: Shaped<Sess[]>; pending: Shaped<Req[]>; dismissed: Shaped<Record<string, number>>; replyTo: Shaped<string>; reading: Shaped<string> }
  }
}
