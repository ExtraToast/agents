<script setup lang="ts">
import type { SessionSocket } from '../services/sessionSocket'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { attachSessionSocket } from '../services/sessionSocket'
import '@xterm/xterm/css/xterm.css'

const props = defineProps<{ sessionId: string; active?: boolean }>()

const container = ref<HTMLDivElement | null>(null)

let term: Terminal | null = null
let fitAddon: FitAddon | null = null
let socket: SessionSocket | null = null
let resizeObserver: ResizeObserver | null = null

const KEY_ESCAPE = '\x1B'
const KEY_CTRL_C = '\x03'
const KEY_ARROW_UP = '\x1B[A'
const KEY_ARROW_DOWN = '\x1B[B'
const KEY_ARROW_RIGHT = '\x1B[C'
const KEY_ARROW_LEFT = '\x1B[D'
const KEY_TAB = '\t'

function fitAndReportSize(): void {
  if (!fitAddon || !term) return
  fitAddon.fit()
  // The gateway sizes the PTY from the RESIZE frame; xterm's own
  // onResize fires from fit(), so the report happens via that handler.
}

function selectedText(): string {
  return term?.getSelection?.() ?? ''
}

async function copySelection(refocus = true): Promise<boolean> {
  const text = selectedText()

  try {
    if (!text || !navigator.clipboard?.writeText) return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  } finally {
    if (refocus && props.active) void revealAndFocus()
  }
}

function sendTerminalKey(key: string): void {
  socket?.sendKey(key)
  if (props.active) void revealAndFocus()
}

async function pasteClipboard(): Promise<void> {
  try {
    const text = await navigator.clipboard?.readText?.()
    if (text) socket?.sendKey(text)
  } finally {
    if (props.active) void revealAndFocus()
  }
}

function isCopyShortcut(event: KeyboardEvent): boolean {
  return event.key.toLowerCase() === 'c' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey
}

onMounted(() => {
  const el = container.value
  if (!el) return

  term = new Terminal({
    convertEol: false,
    cursorBlink: true,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 13,
    // xterm keeps only 1000 scrollback lines by default, so a
    // long-running agent session scrolls its own history out of reach
    // within minutes. Hold far more — this is browser memory, not the
    // server's, so it does not affect the streaming backend.
    scrollback: 50_000,
    rightClickSelectsWord: true,
    theme: { background: '#0b0e14' },
  })
  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.open(el)
  fitAddon.fit()

  socket = attachSessionSocket({
    sessionId: props.sessionId,
    onOutput: (text) => term?.write(text),
    onControl: (_epoch, snapshot) => {
      if (snapshot) term?.clear()
    },
    onReplayComplete: () => {
      if (props.active) void revealAndFocus()
    },
  })
  // Only the visible terminal keeps its socket warm; a hidden tab is
  // allowed to lapse so it does not pin its runner against the idle
  // reaper, then reconnects when shown again.
  socket.setReconnect(props.active ?? false)

  // xterm emits raw keystroke bytes (incl. "\r"); the gateway's
  // send-keys -l passes them literally, so enter is always false.
  term.onData((data) => socket?.send(data, false))

  term.onResize(({ cols, rows }) => {
    socket?.sendResize(cols, rows)
  })

  term.onSelectionChange?.(() => {
    void copySelection(false)
  })

  term.attachCustomKeyEventHandler?.((event) => {
    if (event.type !== 'keydown' || !isCopyShortcut(event)) return true

    if (selectedText()) {
      event.preventDefault()
      void copySelection(false)
      return false
    }

    event.preventDefault()
    socket?.sendKey(KEY_CTRL_C)
    return false
  })

  resizeObserver = new ResizeObserver(() => fitAndReportSize())
  resizeObserver.observe(el)
  window.addEventListener('resize', fitAndReportSize)

  if (props.active) void revealAndFocus()
})

// While a terminal is hidden via `display:none` (v-show on an
// inactive tab) xterm cannot measure its container, so fit() computed
// against the previous tab's geometry. Re-fit and focus once the tab
// becomes visible again so the PTY size matches the viewport.
async function revealAndFocus(): Promise<void> {
  await nextTick()
  if (!term) return
  fitAndReportSize()
  term.focus()
}

watch(
  () => props.active,
  (isActive) => {
    socket?.setReconnect(isActive ?? false)
    if (isActive) {
      // Returning to a tab whose socket lapsed while hidden: bring it
      // back immediately rather than waiting for a keystroke to notice.
      socket?.reconnectNow()
      void revealAndFocus()
    }
  },
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', fitAndReportSize)
  resizeObserver?.disconnect()
  resizeObserver = null
  socket?.close()
  socket = null
  term?.dispose()
  term = null
  fitAddon = null
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded bg-[#0b0e14]">
    <div class="flex items-center justify-end border-b border-white/10 bg-[#11151c] px-2 py-1">
      <button
        type="button"
        class="rounded border border-white/15 px-2 py-1 text-xs font-medium text-slate-100 hover:bg-white/10"
        data-testid="session-terminal-copy"
        @click="copySelection()"
      >
        Copy
      </button>
    </div>
    <div ref="container" class="min-h-0 flex-1 overflow-hidden p-2" data-testid="session-terminal" />
    <div class="terminal-touch-bar border-t border-white/10 bg-[#11151c] px-2 py-1">
      <button type="button" data-testid="terminal-touch-esc" @click="sendTerminalKey(KEY_ESCAPE)">Esc</button>
      <button type="button" data-testid="terminal-touch-ctrl-c" @click="sendTerminalKey(KEY_CTRL_C)">Ctrl-C</button>
      <button type="button" data-testid="terminal-touch-left" @click="sendTerminalKey(KEY_ARROW_LEFT)">Left</button>
      <button type="button" data-testid="terminal-touch-up" @click="sendTerminalKey(KEY_ARROW_UP)">Up</button>
      <button type="button" data-testid="terminal-touch-down" @click="sendTerminalKey(KEY_ARROW_DOWN)">Down</button>
      <button type="button" data-testid="terminal-touch-right" @click="sendTerminalKey(KEY_ARROW_RIGHT)">Right</button>
      <button type="button" data-testid="terminal-touch-tab" @click="sendTerminalKey(KEY_TAB)">Tab</button>
      <button type="button" data-testid="terminal-touch-focus" @click="revealAndFocus()">Focus</button>
      <button type="button" data-testid="terminal-touch-paste" @click="pasteClipboard()">Paste</button>
    </div>
  </div>
</template>

<style scoped>
.terminal-touch-bar {
  display: none;
  gap: 0.25rem;
  overflow-x: auto;
}

.terminal-touch-bar button {
  border: 1px solid rgb(255 255 255 / 15%);
  border-radius: 0.25rem;
  color: rgb(241 245 249);
  flex: 0 0 auto;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1rem;
  padding: 0.375rem 0.5rem;
}

.terminal-touch-bar button:active {
  background: rgb(255 255 255 / 12%);
}

@media (pointer: coarse) {
  .terminal-touch-bar {
    display: flex;
  }
}
</style>
