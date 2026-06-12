import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import SessionTerminal from '../components/SessionTerminal.vue'
import { attachSessionSocket } from '../services/sessionSocket'

// Build a minimal KeyboardEvent stub for the captured custom-key handler.
function keyboardEvent(init: Partial<KeyboardEvent>): KeyboardEvent {
  // eslint-disable-next-line ts/consistent-type-assertions -- test stub, not a real DOM event
  return init as KeyboardEvent
}

// xterm touches real DOM/canvas APIs jsdom does not implement, so the
// Terminal + FitAddon are stubbed. The stub captures the data/resize
// handlers and exposes the write spy so both directions can be asserted.
let onDataCb: ((data: string) => void) | undefined
let onResizeCb: ((e: { cols: number; rows: number }) => void) | undefined
let onSelectionChangeCb: (() => void) | undefined
let customKeyHandler: ((event: KeyboardEvent) => boolean) | undefined
const term = {
  write: vi.fn(),
  loadAddon: vi.fn(),
  open: vi.fn(),
  onData: vi.fn((cb: (data: string) => void) => {
    onDataCb = cb
  }),
  onResize: vi.fn((cb: (e: { cols: number; rows: number }) => void) => {
    onResizeCb = cb
  }),
  onSelectionChange: vi.fn((cb: () => void) => {
    onSelectionChangeCb = cb
  }),
  attachCustomKeyEventHandler: vi.fn((cb: (event: KeyboardEvent) => boolean) => {
    customKeyHandler = cb
  }),
  hasSelection: vi.fn(() => false),
  getSelection: vi.fn(() => ''),
  focus: vi.fn(),
  clear: vi.fn(),
  reset: vi.fn(),
  dispose: vi.fn(),
}
let termOptions: Record<string, unknown> | undefined
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    write = term.write
    loadAddon = term.loadAddon
    open = term.open
    onData = term.onData
    onResize = term.onResize
    onSelectionChange = term.onSelectionChange
    attachCustomKeyEventHandler = term.attachCustomKeyEventHandler
    hasSelection = term.hasSelection
    getSelection = term.getSelection
    focus = term.focus
    clear = term.clear
    reset = term.reset
    dispose = term.dispose
    constructor(opts: Record<string, unknown>) {
      termOptions = opts
    }
  },
}))
vi.mock('@xterm/xterm/css/xterm.css', () => ({}))
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit = vi.fn()
  },
}))

const socket = {
  send: vi.fn(),
  sendKey: vi.fn(),
  sendResize: vi.fn(),
  setReconnect: vi.fn(),
  reconnectNow: vi.fn(),
  close: vi.fn(),
  readyState: vi.fn(() => 1),
}
let capturedOnOutput: ((text: string) => void) | undefined
let capturedOnReopen: (() => void) | undefined
let capturedOnControl: ((epoch: number, snapshot: boolean) => void) | undefined
let capturedOnReplayComplete: ((cursor: number | null) => void) | undefined
vi.mock('../services/sessionSocket', () => ({
  attachSessionSocket: vi.fn((opts: {
    onOutput: (t: string) => void
    onControl?: (epoch: number, snapshot: boolean) => void
    onReplayComplete?: (cursor: number | null) => void
    onReopen?: () => void
  }) => {
    capturedOnOutput = opts.onOutput
    capturedOnControl = opts.onControl
    capturedOnReplayComplete = opts.onReplayComplete
    capturedOnReopen = opts.onReopen
    return socket
  }),
}))

const clipboard = {
  writeText: vi.fn(async () => undefined),
  readText: vi.fn(async () => 'pasted text'),
}

describe('sessionTerminal', () => {
  beforeEach(() => {
    Object.values(term).forEach((m) => m.mockClear())
    Object.values(socket).forEach((m) => m.mockClear())
    Object.values(clipboard).forEach((m) => m.mockClear())
    term.hasSelection.mockReturnValue(false)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: clipboard,
    })
    vi.mocked(attachSessionSocket).mockClear()
    capturedOnOutput = undefined
    capturedOnControl = undefined
    capturedOnReplayComplete = undefined
    capturedOnReopen = undefined
    onDataCb = undefined
    onResizeCb = undefined
    onSelectionChangeCb = undefined
    customKeyHandler = undefined
    termOptions = undefined
  })

  afterEach(() => {
    vi.stubGlobal('ResizeObserver', undefined)
  })

  function mountTerminal(props: { sessionId?: string; active?: boolean } = {}) {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
    return mount(SessionTerminal, { props: { sessionId: 'sess-1', ...props } })
  }

  it('writes inbound output frames to the terminal', () => {
    mountTerminal()
    expect(attachSessionSocket).toHaveBeenCalledWith(
      expect.objectContaining({
        onReplayComplete: expect.any(Function),
        sessionId: 'sess-1',
      }),
    )
    capturedOnOutput?.('[31mhello[0m')
    capturedOnOutput?.('--- restart delimiter from gateway ---\r\n')
    expect(term.write).toHaveBeenNthCalledWith(1, '[31mhello[0m', expect.any(Function))
    expect(term.write).toHaveBeenNthCalledWith(2, '--- restart delimiter from gateway ---\r\n', expect.any(Function))
  })

  it('forwards terminal keystrokes as input frames with enter=false', () => {
    mountTerminal()
    onDataCb?.('l')
    onDataCb?.('\r')
    expect(socket.send).toHaveBeenCalledWith('l', false)
    expect(socket.send).toHaveBeenCalledWith('\r', false)
  })

  it('forwards terminal resize as a resize frame', () => {
    mountTerminal()
    onResizeCb?.({ cols: 120, rows: 40 })
    expect(socket.sendResize).toHaveBeenCalledWith(120, 40)
  })

  it('closes the socket and disposes the terminal on unmount', () => {
    const wrapper = mountTerminal()
    wrapper.unmount()
    expect(socket.close).toHaveBeenCalled()
    expect(term.dispose).toHaveBeenCalled()
  })

  it('focuses the terminal when mounted active', async () => {
    mountTerminal({ active: true })
    await nextTick()
    expect(term.focus).toHaveBeenCalled()
  })

  it('does not focus the terminal when mounted inactive', () => {
    mountTerminal({ active: false })
    expect(term.focus).not.toHaveBeenCalled()
  })

  it('focuses the terminal when it becomes active without re-attaching the socket', async () => {
    const wrapper = mountTerminal({ active: false })
    expect(attachSessionSocket).toHaveBeenCalledTimes(1)
    expect(term.focus).not.toHaveBeenCalled()

    await wrapper.setProps({ active: true })
    await nextTick()

    expect(term.focus).toHaveBeenCalled()
    // The socket is attached once at mount; toggling active must not
    // tear it down or open a new one.
    expect(attachSessionSocket).toHaveBeenCalledTimes(1)
    expect(socket.close).not.toHaveBeenCalled()
  })

  it('only keeps the socket warm while the tab is active', async () => {
    const wrapper = mountTerminal({ active: false })
    // Hidden at mount -> reconnect disabled so it does not pin the runner.
    expect(socket.setReconnect).toHaveBeenLastCalledWith(false)

    await wrapper.setProps({ active: true })
    // Shown -> reconnect enabled and an immediate reconnect kicked off
    // so a socket that lapsed while hidden comes back without a keystroke.
    expect(socket.setReconnect).toHaveBeenLastCalledWith(true)
    expect(socket.reconnectNow).toHaveBeenCalled()

    await wrapper.setProps({ active: false })
    expect(socket.setReconnect).toHaveBeenLastCalledWith(false)
  })

  it('does not reset the terminal unconditionally on reconnect', () => {
    mountTerminal({ active: true })
    expect(capturedOnReopen).toBeUndefined()
    expect(term.reset).not.toHaveBeenCalled()
  })

  it('clears the terminal when attach control declares a snapshot', () => {
    mountTerminal({ active: true })
    capturedOnControl?.(4, true)
    expect(term.clear).toHaveBeenCalledTimes(1)
  })

  it('appends output normally when attach control declares a resume', () => {
    mountTerminal({ active: true })
    capturedOnControl?.(4, false)
    capturedOnOutput?.('gap')
    capturedOnOutput?.('live')
    expect(term.clear).not.toHaveBeenCalled()
    expect(term.write).toHaveBeenNthCalledWith(1, 'gap', expect.any(Function))
    expect(term.write).toHaveBeenNthCalledWith(2, 'live', expect.any(Function))
  })

  it('retains a deep scrollback so a long session keeps its history', () => {
    mountTerminal()
    // The 1000-line xterm default scrolls a busy agent session out of
    // reach within minutes; the terminal must request far more. This is
    // browser memory only and does not affect the streaming backend.
    expect(termOptions?.scrollback).toBeGreaterThanOrEqual(50_000)
  })

  it('enables terminal selection hooks and right-click word selection', () => {
    mountTerminal()

    expect(termOptions?.rightClickSelectsWord).toBe(true)
    expect(term.onSelectionChange).toHaveBeenCalledWith(expect.any(Function))
  })

  it('uses replay-complete to refit and focus the active terminal', async () => {
    mountTerminal({ active: true })
    await nextTick()
    term.focus.mockClear()

    capturedOnReplayComplete?.(23)
    await nextTick()

    expect(term.focus).toHaveBeenCalledTimes(1)
  })

  it('does not focus an inactive terminal on replay complete', async () => {
    mountTerminal({ active: false })

    capturedOnReplayComplete?.(23)
    await nextTick()

    expect(term.focus).not.toHaveBeenCalled()
  })

  it('copies the current terminal selection when the Copy control is clicked', async () => {
    const wrapper = mountTerminal({ active: true })
    term.getSelection.mockReturnValue('selected text')

    await wrapper.get('[data-testid="session-terminal-copy"]').trigger('click')
    await flushPromises()

    expect(clipboard.writeText).toHaveBeenCalledWith('selected text')
  })

  it('copies selected text when xterm reports a selection change', async () => {
    mountTerminal({ active: true })
    term.hasSelection.mockReturnValue(true)
    term.getSelection.mockReturnValue('copy-on-select')

    onSelectionChangeCb?.()
    await flushPromises()

    expect(clipboard.writeText).toHaveBeenCalledWith('copy-on-select')
  })

  it('handles Ctrl+C as copy when text is selected', async () => {
    mountTerminal({ active: true })
    term.hasSelection.mockReturnValue(true)
    term.getSelection.mockReturnValue('selected')
    const preventDefault = vi.fn()

    const handled = customKeyHandler?.(keyboardEvent({
      altKey: false,
      ctrlKey: true,
      key: 'c',
      metaKey: false,
      preventDefault,
      shiftKey: false,
      type: 'keydown',
    }))
    await flushPromises()

    expect(handled).toBe(false)
    expect(preventDefault).toHaveBeenCalled()
    expect(clipboard.writeText).toHaveBeenCalledWith('selected')
    expect(socket.sendKey).not.toHaveBeenCalled()
  })

  it('handles Cmd+C as copy when text is selected', async () => {
    mountTerminal({ active: true })
    term.hasSelection.mockReturnValue(true)
    term.getSelection.mockReturnValue('selected')

    const handled = customKeyHandler?.(keyboardEvent({
      altKey: false,
      ctrlKey: false,
      key: 'C',
      metaKey: true,
      preventDefault: vi.fn(),
      shiftKey: false,
      type: 'keydown',
    }))
    await flushPromises()

    expect(handled).toBe(false)
    expect(clipboard.writeText).toHaveBeenCalledWith('selected')
    expect(socket.sendKey).not.toHaveBeenCalled()
  })

  it('passes Ctrl+C through as an interrupt when no text is selected', () => {
    mountTerminal({ active: true })
    const preventDefault = vi.fn()

    const handled = customKeyHandler?.(keyboardEvent({
      altKey: false,
      ctrlKey: true,
      key: 'c',
      metaKey: false,
      preventDefault,
      shiftKey: false,
      type: 'keydown',
    }))

    expect(handled).toBe(false)
    expect(preventDefault).toHaveBeenCalled()
    expect(clipboard.writeText).not.toHaveBeenCalled()
    expect(socket.sendKey).toHaveBeenCalledWith('\x03')
  })

  it('lets non-copy custom key events continue through xterm', () => {
    mountTerminal({ active: true })

    const handled = customKeyHandler?.(keyboardEvent({
      altKey: false,
      ctrlKey: false,
      key: 'x',
      metaKey: false,
      preventDefault: vi.fn(),
      shiftKey: false,
      type: 'keydown',
    }))

    expect(handled).toBe(true)
    expect(socket.sendKey).not.toHaveBeenCalled()
  })

  it('sends touch bar keys through sendKey and focuses from the focus control', async () => {
    const wrapper = mountTerminal({ active: true })
    term.focus.mockClear()

    await wrapper.get('[data-testid="terminal-touch-esc"]').trigger('click')
    await wrapper.get('[data-testid="terminal-touch-ctrl-c"]').trigger('click')
    await wrapper.get('[data-testid="terminal-touch-left"]').trigger('click')
    await wrapper.get('[data-testid="terminal-touch-up"]').trigger('click')
    await wrapper.get('[data-testid="terminal-touch-down"]').trigger('click')
    await wrapper.get('[data-testid="terminal-touch-right"]').trigger('click')
    await wrapper.get('[data-testid="terminal-touch-tab"]').trigger('click')
    await wrapper.get('[data-testid="terminal-touch-focus"]').trigger('click')
    await nextTick()

    expect(socket.sendKey.mock.calls).toEqual([
      ['\x1B'],
      ['\x03'],
      ['\x1B[D'],
      ['\x1B[A'],
      ['\x1B[B'],
      ['\x1B[C'],
      ['\t'],
    ])
    expect(term.focus).toHaveBeenCalled()
  })

  it('sends the composed line plus enter and clears the input', async () => {
    const wrapper = mountTerminal({ active: true })
    const input = wrapper.get<HTMLInputElement>('[data-testid="terminal-compose-input"]')

    await input.setValue('ls -la')
    await wrapper.get('form').trigger('submit')

    expect(socket.send).toHaveBeenCalledWith('ls -la', true)
    expect(input.element.value).toBe('')
  })

  it('pastes clipboard text through sendKey from the touch bar', async () => {
    const wrapper = mountTerminal({ active: true })
    clipboard.readText.mockResolvedValue('from clipboard')

    await wrapper.get('[data-testid="terminal-touch-paste"]').trigger('click')
    await flushPromises()

    expect(clipboard.readText).toHaveBeenCalled()
    expect(socket.sendKey).toHaveBeenCalledWith('from clipboard')
  })

  it('preserves the terminal buffer across inactive and active tab switches', async () => {
    const wrapper = mountTerminal({ active: true })
    capturedOnOutput?.('existing buffer')
    term.clear.mockClear()
    term.dispose.mockClear()
    vi.mocked(attachSessionSocket).mockClear()

    await wrapper.setProps({ active: false })
    await wrapper.setProps({ active: true })
    await nextTick()

    expect(term.write).toHaveBeenCalledWith('existing buffer', expect.any(Function))
    expect(term.clear).not.toHaveBeenCalled()
    expect(term.dispose).not.toHaveBeenCalled()
    expect(attachSessionSocket).not.toHaveBeenCalled()
  })
})
