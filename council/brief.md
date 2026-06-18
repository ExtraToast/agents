# Brief: Eliminate web-terminal input lag and scrolling delay (agents)

## Goal
Produce ONE big, prioritized, parallelizable implementation plan (task DAG) that
**eliminates input→display lag and scrolling delay** in the ExtraToast/agents web
terminal. The plan will be implemented afterward by **sonnet** workers. Confirm
the true root cause with evidence from the code before prescribing fixes.

## Definition of done (for the plan)
- Root cause identified and justified from the actual code (file:line), not guessed.
- Concrete, file-level changes across gateway / agents-api / agents-ui as needed.
- Each task independently implementable + verifiable (CI-verifiable; see constraints).
- Explicit ordering/DAG; mark which tasks are quick wins vs architectural.
- Preserves existing behavior: durable resume (offset/epoch), reconnect, mobile,
  copy/paste, jump-to-latest, idle/presence, SSE status.

## Symptoms (latest, authoritative)
- Severe input→display lag AND **especially severe scrolling delay**.
- **The lag grows with the size of the session history replayed from the backend
  on attach.** This is the strongest clue — treat it as central.
- Two fixes already merged and did NOT resolve it:
  - PR #39: xterm `@xterm/addon-webgl` GPU renderer (DOM→WebGL, with fallback).
  - PR #40: frontend rAF write-coalescing; gateway output chunk 1KiB→16KiB;
    agents-api bridge inbound WS buffer →1MiB.

## Architecture (the terminal pipeline)
tmux pane → `tmux pipe-pane` appends raw PTY bytes to a log/transcript file →
**agent-gateway** (Kotlin) `TranscriptTailer`/`LogTailer` poll the file every
15ms and stream JSON `{output, off}` frames over WebSocket → **agents-api**
(Kotlin) `SessionAttachHandler` bridges browser↔gateway (verbatim relay, passes
`epoch`/`offset` query through) → **agents-ui** (Vue 3) `SessionTerminal.vue` +
`services/sessionSocket.ts` render into **xterm.js 6.0.0** (scrollback 50,000,
WebGL renderer, rAF-coalesced writes).

Key files to analyze (read them, cite line numbers):
- `services/agent-gateway/src/main/kotlin/.../tmux/TranscriptTailer.kt`
- `services/agent-gateway/src/main/kotlin/.../tmux/LogTailer.kt`
- `services/agent-gateway/src/main/kotlin/.../tmux/TranscriptStore.kt`
- `services/agent-gateway/src/main/kotlin/.../tmux/AgentSessionManager.kt`
- `services/agent-gateway/src/main/kotlin/.../tmux/TmuxClient.kt`
- `services/agent-gateway/src/main/kotlin/.../ws/AgentAttachHandler.kt`  (durable replay path: SNAPSHOT/RESUME/REPLAY_COMPLETE, replayAvailable())
- `services/agents-api/src/main/kotlin/.../infrastructure/ws/SessionAttachHandler.kt`
- `services/agents-ui/src/features/workspaces/components/SessionTerminal.vue`
- `services/agents-ui/src/features/workspaces/services/sessionSocket.ts`

## Durable replay (suspected hot path)
For durable sessions `AgentAttachHandler.attachDurable` replays the transcript
from `metadata.logicalStart` (the front-trimmed start, up to a ~50MB cap) through
`TranscriptTailer.replayAvailable()` on EVERY attach, emitting the full raw byte
stream as `{output, off}` frames. The non-durable path instead sends only a
`capture-pane -e -p` **visible-screen snapshot** then tails new bytes.

## Leading hypothesis (validate or refute with evidence)
Replaying the **entire raw PTY transcript** (megabytes of cursor-move/repaint
escape sequences a TUI like Claude Code emits continuously) into xterm on every
attach forces xterm to parse all of it sequentially to rebuild screen state,
blocking the main thread; and the **50,000-line scrollback** makes scroll/reflow
O(history). Net: cost scales with history — exactly the reported symptom.

Candidate fix directions (the plan should evaluate, not assume):
1. Stop replaying the whole raw log into the renderer. On attach send a bounded
   **visible snapshot** (tmux `capture-pane -e -p`, like the non-durable path and
   the friend's lag-free ttyd-replacement) and only tail forward; keep durable
   offset semantics for *missed-while-connected* gaps, not for full cold-start
   history.
2. Cap replay to the last N bytes/lines (tail window) instead of logicalStart.
3. Reconsider scrollback (50,000 is large; measure cost vs a smaller cap or
   server-driven history-on-demand).
4. Server-side screen reconstruction (feed only the minimal escape stream that
   reproduces the current screen) vs raw replay.
5. Off-main-thread or batched replay so a cold attach can't jank scrolling.
6. Verify the WebGL renderer is actually active (not silently DOM-fallback) and
   tune renderer/scrollback interplay.

## External research to fold in (provided separately, prioritize it)
A dedicated opus web-research report on building zero-input-lag web terminals
(xterm.js perf best practices; renderer tuning; scrollback strategies;
reconnect/history without lag; how ttyd / wetty / gotty / sshx / VS Code &
Theia terminal / Warp / native tmux attach handle history replay) will be
appended below under "## Web research findings" before planning. Reconcile the
codebase analysis against it.

## Constraints (hard)
- **No local build/test possible**: pnpm + gradle installs are blocked by the
  GitHub Packages auth wall. Everything is verified in **CI** (UI lint/typecheck/
  test/build; JVM lint/test/build; OpenAPI contract). Plan tasks must be
  CI-verifiable; add/adjust unit tests where behavior changes.
- Repo conventions: single CI workflow aggregates to a required **"Pipeline
  Complete"** check; **squash-only** merges; one feature per PR/branch.
- **Never** add Claude/AI co-author trailers or "Generated with Claude Code".
- xterm 6.0.0 / addon-fit 0.11.0 / addon-webgl 0.19.0 (same publish wave).
- Keep the gateway dumb (no rich protocol creep); durable resume + epoch must
  keep working; mobile + touch behavior must be preserved.

## Deliverables
- `consolidated_plan.md`: root-cause statement (with evidence), prioritized
  changes, risks, and a clear quick-wins-first ordering.
- `tasks.json`: parallelizable DAG for sonnet workers, each task scoped to
  file-level edits + the CI signal that proves it.

---

## Web research findings (opus 4.8, prioritize — confirms the leading hypothesis)

**Bottom line:** The lag does NOT come from xterm rendering (WebGL + rAF coalescing are already correct). It comes from **what we feed `term.write()` on attach**: replaying the entire raw ANSI transcript forces xterm to parse+apply every escape sequence sequentially **on the main thread** (cost O(transcript bytes)), and `scrollback: 50000` makes the buffer allocation/reflow huge. Lag scales with transcript size **by construction**. Input echo is blocked because keystrokes share the main thread with the replay-parse backlog. WebGL/rAF address render + write-scheduling cost, NOT parse cost or buffer/reflow cost — which is why they didn't fix it.

### xterm.js facts that matter
- `terminal.write()` is non-blocking but parse cost is proportional to bytes + escape complexity; write buffer has a hardcoded ~50MB cap (silent data loss past it).
- `scrollback: 50000` is almost certainly too large: reflow on resize at 100k lines was ~18s pre-optimization / <1s post; ~70ms at 10k lines; 50k means **hundreds of ms of main-thread jank per resize**, and resize fires repeatedly during a drag. Copying a 5000-line buffer ≈ 30–60ms; 50k is 10× that. Scrolling a giant buffer = more work per scroll event. **Cut scrollback to 1000–5000** (VS Code live=1000/restored=100; tmux=2000; gotty=5000).
- WebGL: no public `getActiveRenderer()`; failure throws on construct/loadAddon (no silent degrade). Verify active via presence of WebGL `<canvas>` + absence of DOM per-cell spans; **log which renderer won** so silent DOM fallback is observable. Handle `onContextLoss` by dispose **and recreate** (try/catch) so post-sleep sessions aren't frozen/stuck on DOM.
- xterm recommends **watermark flow control** (pause producer above HIGH ~500K unparsed, resume below LOW) via an application-level WS ACK. Our gateway has NONE today — it floods `term.write()` on bursts/replay.

### How real implementations replay (NOBODY replays the full raw transcript)
- **ttyd / wetty / gotty**: replay NOTHING — forward-only; `terminal.reset()` on reconnect.
- **VS Code**: serialized **screen snapshot** via SerializeAddon; restored scrollback only **100** lines (`persistentSessionScrollback`).
- **sshx**: bounded **raw-byte ring = 2 MiB per shell** (`SHELL_STORED_BYTES = 1<<21`), drains oldest; clients catch up from any **byte offset** (`subscribe_chunks(offset)`). NOTE: sshx stores raw bytes + parses in browser — NOT a server emulator (premise corrected).
- **Theia**: bounded raw disconnect buffer ~**100 kB**.
- **tmux/screen (the key native analogy)**: redraw from an **in-memory cell grid** (visible + history-limit, default 2000), NEVER the byte log. `capture-pane -p -e -S -<n>` serializes that rendered grid; **`pipe-pane` is a stateless raw byte tee with no screen state**. OUR SYSTEM USES `pipe-pane` then makes the client reconstruct the whole screen every attach — that is the architectural mismatch. The native-tmux way: `capture-pane` snapshot + tail the live delta.
- Pitfall: a raw tail can start mid-escape-sequence or inside the alternate screen → garbled; snapshot avoids this. If tailing raw, prefer line-aligned boundaries and prefix `reset` + cursor-home.

### Ranked recommendations
Architectural (fix the root cause):
1. **Stop replaying the full transcript; replay a bounded snapshot of current screen + ~1000–2000 scrollback lines.** Reconnect cost becomes constant regardless of session age. Cheapest path: on attach run `tmux capture-pane -p -e -S -2000`, send as snapshot, then tail the live delta — must atomically pin the tail offset at capture time to avoid gap/overlap. Best long-term: server-side headless VT emulator (JVM jediterm-style, or Rust `vte`/`alacritty_terminal` sidecar) emitting one ANSI snapshot (mirrors tmux capture-pane / VS Code SerializeAddon). Always `reset()` then write snapshot then resume from pinned offset — never write snapshot AND overlapping raw tail.
2. **Byte-offset resume for live reconnects (we already send `off`)**: if client's last `off` is within the retained window, stream only bytes after it (zero replay); only snapshot/tail when the gap exceeds the window.
3. **Drop scrollback 50000 → 1000–5000.** Deep history via scroll-to-load / "view full log" backed by the server file, not 50k live rows.
4. **Watermark flow control with WS ACK** between gateway and browser (pause tail above HIGH ~500K, resume below LOW) — the safety net so bursty live output can't re-introduce lag after replay is fixed.

Quick wins:
5. **Debounce resize** (~100–150ms trailing); never resize during/after a large write.
6. **Verify WebGL active + instrument** (try/catch → CanvasAddon fallback; log winner).
7. **onContextLoss → dispose AND recreate** (try/catch).
8. **Coalesce server frames** (gateway emits ~66 tiny JSON frames/sec at 15ms): batch tail reads into ~30–50ms or size-triggered frames; cap max latency ~30ms so echo stays snappy.
9. **`terminal.reset()` before writing the snapshot** on full reattach.

Suggested phasing: Phase 1 (quick, days): #3 scrollback cut, #5 resize debounce, #6 WebGL verify/instrument, #8 gateway frame coalescing. Phase 2 (the real fix): #2 offset-resume for live reconnects, then #1 bounded snapshot replay (start with `tmux capture-pane`, graduate to server emulator), plus #4 watermark flow control.
