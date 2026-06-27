<script setup lang="ts">
import type { RestartSessionState } from '../stores/workspaces'
import type { AgentKind } from '../types'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Modal, useToast } from '@/lib/vueWebCommons'
import NewSessionTabDropdown from '../components/NewSessionTabDropdown.vue'
import SessionStatusRail from '../components/SessionStatusRail.vue'
import SessionTabs from '../components/SessionTabs.vue'
import SessionTerminal from '../components/SessionTerminal.vue'
import WorkspaceRepositoriesPanel from '../components/WorkspaceRepositoriesPanel.vue'
import WorkspaceRepositoryPicker from '../components/WorkspaceRepositoryPicker.vue'
import WorkspaceSplitGuidance from '../components/WorkspaceSplitGuidance.vue'
import { sendInput, stageInput } from '../services/workspaceService'
import { useSessionConsoleViewModelsStore } from '../stores/sessionConsoleViewModels'
import { useSessionStatusesStore } from '../stores/sessionStatuses'
import { useWorkspaceRunnerStatusesStore } from '../stores/workspaceRunnerStatuses'
import { useWorkspacesStore } from '../stores/workspaces'

const route = useRoute()
const store = useWorkspacesStore()
const statuses = useSessionStatusesStore()
const runnerStatuses = useWorkspaceRunnerStatusesStore()
const consoleViewModels = useSessionConsoleViewModelsStore()
const toast = useToast()

const workspaceId = computed(() => String(route.params.id))
// The controls live in a right-side rail that folds in/out via an arrow that
// rides the pane edge; on phones it folds away by default so the terminal is
// the priority. Fullscreen (mobile) breaks the console out of the app shell so
// the terminal + controls own the whole viewport. Sizing stays CSS (svh/dvh).
const mobileQuery
  = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 1023px)') : null
const isMobile = ref(mobileQuery?.matches ?? false)
const showSidebar = ref(true)
const isFullscreen = ref(false)

function syncIsMobile(event?: MediaQueryListEvent): void {
  isMobile.value = event?.matches ?? mobileQuery?.matches ?? false
}

const showStageInput = ref(false)
const showRepositoryPicker = ref(false)
const stageName = ref('source.txt')
const stageContent = ref('')
const isStaging = ref(false)
const isSendingSplitCommand = ref(false)
const isAttachingRepository = ref(false)
const detachingRepositoryId = ref<string | null>(null)
const repositoryActionError = ref<string | null>(null)
const consoleSurface = ref<HTMLElement | null>(null)
const restartConfirmPanel = ref<HTMLElement | null>(null)
// Copy moved off the terminal chrome into the controls rail: keep a handle on
// each mounted terminal so the rail's Copy button can drive the active one.
const terminalRefs = new Map<string, TerminalHandle>()
let loadSeq = 0

interface TerminalHandle { copySelection: () => Promise<boolean>; refit: () => Promise<void> }

function setTerminalRef(id: string, instance: unknown): void {
  // Component refs arrive untyped; narrow to the exposed actions.
  // eslint-disable-next-line ts/consistent-type-assertions
  const handle = instance as Partial<TerminalHandle> | null
  if (handle && typeof handle.copySelection === 'function' && typeof handle.refit === 'function') {
    terminalRefs.set(id, { copySelection: handle.copySelection, refit: handle.refit })
    return
  }
  terminalRefs.delete(id)
}

// Drive an exposed action on the currently visible terminal, if any.
function withActiveTerminal(action: (handle: TerminalHandle) => unknown): void {
  const id = store.activeSessionId
  const handle = id ? terminalRefs.get(id) : undefined
  if (handle) void action(handle)
}

function copyActiveSelection(): void {
  withActiveTerminal((t) => t.copySelection())
}

// Only sessions with a live PTY get a mounted terminal. A session
// dropping out of this set (STOPPED/FAILED) unmounts its
// SessionTerminal, which closes the socket and disposes xterm.
const consoleSessions = computed(() => statuses.mergedSessions)
const liveSessions = computed(() => statuses.liveSessions)
const activeSession = computed(() => consoleSessions.value.find((s) => s.id === store.activeSessionId) ?? null)
const activeStageSession = computed(() => {
  const session = activeSession.value
  return session?.status === 'RUNNING' ? session : null
})
const activeConsoleSession = computed(() => consoleViewModels.activeSession)
const activeRailSession = computed(() => {
  const viewModel = activeConsoleSession.value
  if (!viewModel) return null
  const session = consoleSessions.value.find((s) => s.id === viewModel.id) ?? null
  const overlay = statuses.overlays[viewModel.id]
  return {
    ...viewModel,
    lastStatusUpdate: overlay?.ts ?? session?.updatedAt ?? null,
    updatedAt: session?.updatedAt ?? null,
    epoch: session?.epoch ?? null,
    generation: session?.generation ?? null,
  }
})
const activeSessionIsLive = computed(() =>
  Boolean(activeSession.value && liveSessions.value.some((s) => s.id === activeSession.value?.id)),
)
const agentKindLabels: Record<AgentKind, string> = {
  CLAUDE: 'Claude Code',
  CODEX: 'Codex',
  SHELL: 'shell',
}
const spawnDisabled = computed(() => store.startingSession || store.runnerReadiness === 'booting')
const spawnButtonLabel = computed(() => {
  if (store.startingSession) return 'Starting runner…'
  if (store.runnerReadiness === 'booting') return 'Runner booting…'
  return `Start ${agentKindLabels.CLAUDE}`
})
const restartLabels: Record<RestartSessionState, string | null> = {
  'idle': null,
  'confirm-pending': 'Confirm restart',
  'in-progress': 'Restart request in progress',
  'reconnecting': 'Reconnecting',
  'reattaching': 'Reattaching terminal',
  'replaying-history': 'Replaying terminal history',
  'live': 'Restart complete',
  'failed': 'Restart failed',
}
const activeRestartState = computed<RestartSessionState>(() => {
  const session = activeSession.value
  return session ? store.restartStateFor(session.id) : 'idle'
})
const activeRestartLabel = computed(() => restartLabels[activeRestartState.value])
const canRestartActive = computed(() => {
  if (!activeSession.value) return false
  return !['confirm-pending', 'in-progress', 'reconnecting', 'reattaching', 'replaying-history'].includes(activeRestartState.value)
})
const canStopActive = computed(() => activeSession.value?.status === 'RUNNING')
const activeEmptyTitle = computed(() => {
  if (!activeSession.value) return 'No active session'
  if (activeSession.value.status === 'FAILED') return 'Session failed'
  if (activeSession.value.status === 'STOPPED') return 'Session stopped'
  return 'Terminal unavailable'
})
const activeEmptyCopy = computed(() => {
  if (!activeSession.value) return 'Start an agent to open a terminal.'
  if (activeSession.value.status === 'FAILED') return 'Restart the session or start a new agent.'
  if (activeSession.value.status === 'STOPPED') return 'Restart this session or switch to a live one.'
  return 'Waiting for the runner to attach.'
})

watch(workspaceId, (id) => {
  void openWorkspace(id)
}, { immediate: true })

watch(activeRestartState, async (state) => {
  if (state !== 'confirm-pending') {
    if (state !== 'idle') await focusConsoleSurface()
    return
  }
  await nextTick()
  restartConfirmPanel.value?.focus()
})

watch(
  () => store.activeSessionId,
  async (id, previousId) => {
    if (id && id !== previousId) await focusConsoleSurface()
  },
)

// Folding the controls sidebar in/out (and toggling full screen) changes the
// terminal column's width in the same tick the sidebar is added/removed, which
// the terminal's own ResizeObserver can miss — so re-fit the visible terminal
// explicitly whenever the console layout shifts.
watch([showSidebar, isFullscreen], () => withActiveTerminal((t) => t.refit()))

onMounted(() => {
  statuses.useWorkspace(workspaceId.value)
  syncIsMobile()
  if (isMobile.value) {
    showSidebar.value = false
  }
  mobileQuery?.addEventListener('change', syncIsMobile)
})

onUnmounted(() => {
  statuses.useWorkspace(null)
  runnerStatuses.useWorkspace(null)
  mobileQuery?.removeEventListener('change', syncIsMobile)
})

async function openWorkspace(id: string): Promise<void> {
  const seq = ++loadSeq
  await store.open(id)
  if (seq !== loadSeq) return
  statuses.syncRestSessions()
  statuses.useWorkspace(id)
  runnerStatuses.useWorkspace(id)
  await focusConsoleSurface()
}

async function focusConsoleSurface(): Promise<void> {
  await nextTick()
  if (activeRestartState.value === 'confirm-pending') return
  consoleSurface.value?.focus()
}

async function onSpawn(kind: AgentKind = 'CLAUDE'): Promise<void> {
  try {
    await store.newSession(kind)
  } catch (e) {
    toast.errorFromCatch('Could not start session', e)
  }
  statuses.syncRestSessions()
  await focusConsoleSurface()
}

async function onStopSession(id: string): Promise<void> {
  await store.endSession(id)
  statuses.syncRestSessions()
  await focusConsoleSurface()
}

async function onSelectSession(id: string): Promise<void> {
  store.selectSession(id)
  await focusConsoleSurface()
}

async function onRequestRestart(): Promise<void> {
  const session = activeSession.value
  if (!session) return
  await store.requestRestartConfirmation(session.id)
}

function onCancelRestart(): void {
  const session = activeSession.value
  if (!session) return
  store.cancelRestartConfirmation(session.id)
}

async function onConfirmRestart(): Promise<void> {
  const session = activeSession.value
  if (!session) return
  try {
    const restarted = await store.restartSession(session.id, session.generation)
    statuses.syncRestSessions()
    toast.success(restarted ? 'Restart requested' : 'Restart state refreshed')
  } catch (e) {
    toast.errorFromCatch('Could not restart session', e)
  } finally {
    await focusConsoleSurface()
  }
}

async function onUpdateRunner(): Promise<void> {
  const session = activeSession.value
  if (!session) return
  try {
    const restarted = await store.restartSession(session.id, session.generation)
    statuses.syncRestSessions()
    toast.success(restarted ? 'Updating runner — recreating on the latest image…' : 'Runner refresh requested')
  } catch (e) {
    toast.errorFromCatch('Could not update runner', e)
  } finally {
    await focusConsoleSurface()
  }
}

function closeStageInput(): void {
  if (isStaging.value) return
  showStageInput.value = false
  stageContent.value = ''
}

async function onStageInput(): Promise<void> {
  const ws = store.activeWorkspace
  const session = activeStageSession.value
  if (!ws || !session || stageContent.value.length === 0) return
  isStaging.value = true
  try {
    const staged = await stageInput(ws.id, session.id, stageContent.value, stageName.value)
    const prompt = `Please read ${staged.path} and use it as the source document for the next task.`
    await sendInput(ws.id, session.id, prompt, true)
    toast.success('Text staged', staged.path)
    showStageInput.value = false
    stageContent.value = ''
  } catch (e) {
    toast.errorFromCatch('Could not stage text', e)
  } finally {
    isStaging.value = false
  }
}

async function onSendSplitCommand(command: string): Promise<void> {
  const ws = store.activeWorkspace
  const session = activeStageSession.value
  if (!ws || !session || !command.trim()) return
  isSendingSplitCommand.value = true
  try {
    await sendInput(ws.id, session.id, command.trim(), true)
    toast.success('Split command sent')
  } catch (e) {
    toast.errorFromCatch('Could not send split command', e)
  } finally {
    isSendingSplitCommand.value = false
  }
}

async function onAttachRepository(repositoryId: string): Promise<void> {
  repositoryActionError.value = null
  isAttachingRepository.value = true
  try {
    await store.attachRepository(repositoryId)
    showRepositoryPicker.value = false
    toast.success('Repository attached')
  } catch (e) {
    repositoryActionError.value = 'Could not attach the repository'
    toast.errorFromCatch('Could not attach the repository', e)
  } finally {
    isAttachingRepository.value = false
  }
}

async function onDetachRepository(repositoryId: string, repositoryName: string): Promise<void> {
  repositoryActionError.value = null
  detachingRepositoryId.value = repositoryId
  try {
    await store.detachRepository(repositoryId)
    toast.success(`Removed ${repositoryName}`)
  } catch (e) {
    repositoryActionError.value = 'Could not remove the repository'
    toast.errorFromCatch('Could not remove the repository', e)
  } finally {
    detachingRepositoryId.value = null
  }
}
</script>

<template>
  <div
    class="flex h-dvh min-h-[100svh] flex-col overflow-hidden bg-[var(--color-surface-dark)] pt-[env(safe-area-inset-top)] text-[var(--color-text-primary)]"
    :class="isFullscreen ? 'fixed inset-0 z-[60]' : 'relative'"
    data-testid="workspace-console"
  >
    <header
      class="z-10 flex shrink-0 flex-col border-b border-[var(--color-surface-border)] bg-[var(--color-surface-dark)] px-3 sm:px-5"
      :class="isFullscreen ? 'gap-0 py-1' : 'gap-2 py-2'"
      data-testid="workspace-view-header"
    >
      <div class="flex min-w-0 items-start gap-3">
        <div class="min-w-0 flex-1">
          <h1 class="truncate text-lg font-bold sm:text-xl">
            {{ store.activeWorkspace?.name ?? 'Loading…' }}
          </h1>
          <p
            v-if="store.activeWorkspace?.repoUrl && !isFullscreen"
            class="truncate font-mono text-xs text-[var(--color-text-muted)]"
            :title="store.activeWorkspace.repoUrl"
          >
            {{ store.activeWorkspace.repoUrl }}
          </p>
        </div>
        <div class="ml-auto flex shrink-0 items-center gap-2">
          <span
            class="hidden items-center gap-1.5 rounded px-2 py-1 text-xs text-[var(--color-text-muted)] sm:inline-flex"
            data-testid="workspace-status-summary"
          >
            <span
              class="size-1.5 rounded-full"
              :class="statuses.connectionState === 'open' ? 'bg-green-400' : 'bg-amber-400'"
            />
            {{ statuses.connectionState === 'open' ? 'Live' : activeRestartLabel ?? 'Connecting' }}
          </span>
          <!-- Controls fold toggle: same size and position as the fullscreen
               button, on both mobile and PC. When closed the controls pane is
               removed entirely so the terminal gets the full width. -->
          <button
            v-if="store.activeWorkspace && !isFullscreen"
            type="button"
            class="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-md border border-[var(--color-surface-border)] bg-[var(--color-surface-elevated)] px-2 text-base text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)]"
            :aria-expanded="showSidebar"
            aria-controls="workspace-sidebar"
            data-testid="workspace-sidebar-toggle"
            :title="showSidebar ? 'Hide controls' : 'Show controls'"
            @click="showSidebar = !showSidebar"
          >
            {{ showSidebar ? '›' : '‹' }}
          </button>
          <button
            type="button"
            class="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-md border border-[var(--color-surface-border)] bg-[var(--color-surface-elevated)] px-2 text-base text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)] lg:hidden"
            :aria-pressed="isFullscreen"
            data-testid="workspace-fullscreen-toggle"
            :title="isFullscreen ? 'Exit full screen' : 'Full screen'"
            @click="isFullscreen = !isFullscreen"
          >
            {{ isFullscreen ? '✕' : '⛶' }}
          </button>
        </div>
      </div>
    </header>

    <main
      class="flex min-h-0 flex-1 overflow-hidden pb-[env(safe-area-inset-bottom)]"
      data-testid="workspace-console-main"
    >
      <section class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <!-- Tabs sit flush on top of the terminal: the active tab's accent
             underline meets the terminal with no gap. -->
        <!-- Only the tab strip scrolls horizontally; the "+" dropdown sits
             outside the overflow container so its absolutely-positioned menu
             is never clipped by overflow-x/overflow-y. -->
        <nav
          v-if="store.activeWorkspace && !isFullscreen"
          class="flex min-w-0 shrink-0 items-stretch bg-[var(--color-surface-dark)] pr-2"
          data-testid="workspace-tabs"
          aria-label="Sessions"
        >
          <div class="flex min-w-0 items-stretch">
            <SessionTabs
              :sessions="consoleSessions"
              :active-id="store.activeSessionId"
              orientation="horizontal"
              @select="onSelectSession"
              @delete="onStopSession"
            />
          </div>
          <NewSessionTabDropdown
            :starting="store.startingSession"
            @select="onSpawn"
          />
        </nav>
        <div
          ref="consoleSurface"
          tabindex="-1"
          class="console-surface flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0b0e14]"
          data-testid="workspace-hero-terminal"
        >
          <!-- One terminal per live session, all kept mounted; v-show keeps tab buffers while switching. -->
          <SessionTerminal
            v-for="s in liveSessions"
            v-show="s.id === store.activeSessionId"
            :key="s.id"
            :ref="(el) => setTerminalRef(s.id, el)"
            :session-id="s.id"
            :active="s.id === store.activeSessionId"
          />
          <div
            v-if="!activeSessionIsLive"
            class="flex min-h-0 flex-1 items-center justify-center p-6 text-center"
            data-testid="workspace-empty-state"
          >
            <div class="max-w-sm space-y-3">
              <h2 class="text-lg font-semibold text-slate-100">{{ activeEmptyTitle }}</h2>
              <p class="text-sm text-slate-400">{{ activeEmptyCopy }}</p>
              <button
                type="button"
                class="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--color-accent)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="spawnDisabled"
                data-testid="workspace-empty-start"
                @click="onSpawn('CLAUDE')"
              >
                {{ spawnButtonLabel }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <aside
        v-if="store.activeWorkspace && !isFullscreen && showSidebar"
        id="workspace-sidebar"
        class="flex w-full shrink-0 flex-col border-l border-[var(--color-surface-border)] bg-[var(--color-surface-card)] lg:w-[min(22rem,85vw)]"
        data-testid="workspace-sidebar"
        aria-label="Workspace controls"
      >
        <div
          id="workspace-sidebar-body"
          class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
        >
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="inline-flex min-h-10 flex-1 items-center justify-center rounded-md border border-[var(--color-surface-border)] bg-[var(--color-surface-elevated)] px-3 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canStopActive"
              data-testid="workspace-active-stop"
              @click="activeSession && onStopSession(activeSession.id)"
            >
              Stop
            </button>
            <button
              type="button"
              class="inline-flex min-h-10 flex-1 items-center justify-center rounded-md border border-[var(--color-surface-border)] bg-[var(--color-surface-elevated)] px-3 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canRestartActive"
              data-testid="workspace-active-restart"
              @click="onRequestRestart"
            >
              Restart
            </button>
          </div>
          <button
            type="button"
            class="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-[var(--color-surface-border)] bg-[var(--color-surface-elevated)] px-3 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!activeSessionIsLive"
            data-testid="session-terminal-copy"
            title="Copy the current terminal selection"
            @click="copyActiveSelection"
          >
            Copy selection
          </button>
          <SessionStatusRail
            class="shrink-0"
            :session="activeRailSession"
            :connection-state="statuses.connectionState"
            :connection-error="statuses.connectionError"
            :runner-image="store.activeWorkspace.runnerImage ?? null"
            @update-runner="onUpdateRunner"
          />
          <div
            v-if="activeRestartState === 'confirm-pending'"
            ref="restartConfirmPanel"
            tabindex="-1"
            class="space-y-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)]"
            data-testid="workspace-restart-confirmation"
          >
            <p class="text-amber-100" data-testid="workspace-restart-confirmation-copy">
              Restart this session and reattach the terminal?
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="inline-flex min-h-10 items-center rounded-md bg-[var(--color-accent)] px-3 text-sm font-medium text-white hover:bg-[var(--color-accent-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)]"
                data-testid="workspace-restart-confirm"
                @click="onConfirmRestart"
              >
                Restart
              </button>
              <button
                type="button"
                class="inline-flex min-h-10 items-center rounded-md border border-[var(--color-surface-border)] px-3 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)]"
                data-testid="workspace-restart-cancel"
                @click="onCancelRestart"
              >
                Cancel
              </button>
            </div>
          </div>

          <section
            class="rounded-md border border-[var(--color-surface-border)] bg-[var(--color-surface)] p-3"
            data-testid="workspace-tools-panel"
          >
            <h2 class="text-sm font-semibold">Tools</h2>
            <p id="stage-input-hint" class="sr-only">
              Stage text is available when the active session is running.
            </p>
            <button
              type="button"
              class="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-[var(--color-surface-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-dark)] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!activeStageSession || isStaging"
              data-testid="stage-input-open"
              aria-describedby="stage-input-hint"
              @click="showStageInput = true"
            >
              {{ isStaging ? 'Staging…' : 'Stage text' }}
            </button>
          </section>

        <WorkspaceRepositoriesPanel
          :repositories="store.activeWorkspace.repositories ?? []"
          :attach-pending="isAttachingRepository"
          :detach-pending-id="detachingRepositoryId"
          :error="repositoryActionError"
          @add="showRepositoryPicker = true"
          @detach="onDetachRepository"
        />
        <WorkspaceSplitGuidance
          :repositories="store.activeWorkspace.repositories ?? []"
          :project-id="store.activeWorkspace.projectId"
          :can-send="Boolean(activeStageSession)"
          :send-pending="isSendingSplitCommand"
          @add-destination="showRepositoryPicker = true"
          @send-command="onSendSplitCommand"
        />
        </div>
      </aside>
    </main>

    <Modal :open="showRepositoryPicker" title="Attach repository" @close="showRepositoryPicker = false">
      <WorkspaceRepositoryPicker
        :already-attached="store.activeWorkspace?.repositories ?? []"
        :pending="isAttachingRepository"
        @pick="onAttachRepository"
        @cancel="showRepositoryPicker = false"
      />
    </Modal>

    <Modal :open="showStageInput" title="Stage text" @close="closeStageInput">
      <form class="space-y-4" data-testid="stage-input-form" @submit.prevent="onStageInput">
        <label class="block space-y-1 text-sm">
          <span class="text-[var(--color-text-muted)]">File name</span>
          <input
            v-model="stageName"
            type="text"
            class="w-full rounded border border-[var(--color-surface-border)] bg-[var(--color-surface)] px-3 py-2"
            data-testid="stage-input-name"
          />
        </label>
        <label class="block space-y-1 text-sm">
          <span class="text-[var(--color-text-muted)]">Text</span>
          <textarea
            v-model="stageContent"
            class="min-h-72 w-full rounded border border-[var(--color-surface-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-sm"
            data-testid="stage-input-content"
          />
        </label>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-[var(--color-surface-border)] bg-[var(--color-surface-elevated)] px-4 py-2 text-sm transition-colors hover:bg-[var(--color-surface-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-dark)] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isStaging"
            @click="closeStageInput"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-dark)] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isStaging || stageContent.length === 0"
            data-testid="stage-input-submit"
          >
            {{ isStaging ? 'Staging…' : 'Stage' }}
          </button>
        </div>
      </form>
    </Modal>
  </div>
</template>

<style scoped>
/* The console surface is a programmatic focus target (tabindex=-1), not a
   tab-reachable control. The shared theme draws a 2px accent outline on every
   :focus-visible element, which here wraps the whole terminal and reads as a
   heavy duplicate of the active tab's indicator — suppress it on this surface. */
.console-surface:focus,
.console-surface:focus-visible {
  outline: none;
}
</style>
