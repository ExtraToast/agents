<script setup lang="ts">
import type { RestartSessionState } from '../stores/workspaces'
import type { AgentKind, AgentSetupReference } from '../types'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Modal, useToast } from '@/lib/vueWebCommons'
import AgentKindPicker from '../components/AgentKindPicker.vue'
import SessionSetupDiff from '../components/SessionSetupDiff.vue'
import SessionSetupPicker from '../components/SessionSetupPicker.vue'
import SessionStatusRail from '../components/SessionStatusRail.vue'
import SessionTabs from '../components/SessionTabs.vue'
import SessionTerminal from '../components/SessionTerminal.vue'
import WorkspaceRepositoriesPanel from '../components/WorkspaceRepositoriesPanel.vue'
import WorkspaceRepositoryPicker from '../components/WorkspaceRepositoryPicker.vue'
import WorkspaceSplitGuidance from '../components/WorkspaceSplitGuidance.vue'
import { sendInput, stageInput } from '../services/workspaceService'
import { useSessionConsoleViewModelsStore } from '../stores/sessionConsoleViewModels'
import { useSessionStatusesStore } from '../stores/sessionStatuses'
import { useWorkspacesStore } from '../stores/workspaces'

const route = useRoute()
const store = useWorkspacesStore()
const statuses = useSessionStatusesStore()
const consoleViewModels = useSessionConsoleViewModelsStore()
const toast = useToast()

const workspaceId = computed(() => String(route.params.id))
const pickerKind = ref<AgentKind>('CLAUDE')
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
const setupOptionsLoading = ref(false)
const setupControlsError = ref<string | null>(null)
const consoleSurface = ref<HTMLElement | null>(null)
const restartConfirmPanel = ref<HTMLElement | null>(null)
let loadSeq = 0
let setupOptionsSeq = 0

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
const activeSetupOptions = computed(() => {
  const session = activeSession.value
  return session ? store.setupOptionsBySessionId[session.id] ?? null : null
})
const activeSetupPreview = computed(() => {
  const session = activeSession.value
  return session ? store.setupPreviewsBySessionId[session.id] ?? null : null
})
const activeSetupValidationProblem = computed(() => {
  const session = activeSession.value
  return session ? store.setupValidationProblemsBySessionId[session.id] ?? null : null
})
const activeRestartTarget = computed(() => {
  const session = activeSession.value
  return session ? store.selectedRestartTargetFor(session.id) : null
})
const restartFromSetupLabel = computed(() => setupReferenceLabel(activeSession.value?.currentSetup ?? null))
const restartToSetupLabel = computed(() => setupReferenceLabel(activeRestartTarget.value))
const agentKindLabels: Record<AgentKind, string> = {
  CLAUDE: 'Claude Code',
  CODEX: 'Codex',
  SHELL: 'shell',
}
const spawnButtonLabel = computed(() =>
  store.startingSession ? 'Starting runner…' : `Start ${agentKindLabels[pickerKind.value]}`,
)
const restartLabels: Record<RestartSessionState, string | null> = {
  'idle': null,
  'confirm-pending': 'Confirm restart',
  'in-progress': 'Restart request in progress',
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
const restartSetupControlsVisible = computed(() =>
  Boolean(activeSession.value && activeRestartState.value !== 'idle' && activeRestartState.value !== 'live'),
)
const restartTransitionCopy = computed(() => {
  switch (activeRestartState.value) {
    case 'in-progress':
      return `Restart request is pending from ${restartFromSetupLabel.value} to ${restartToSetupLabel.value}.`
    case 'reattaching':
      return [
        `Restart accepted from ${restartFromSetupLabel.value} to ${restartToSetupLabel.value};`,
        'reattaching the terminal.',
      ].join(' ')
    case 'replaying-history':
      return [
        `Restart accepted from ${restartFromSetupLabel.value} to ${restartToSetupLabel.value};`,
        'replaying terminal history.',
      ].join(' ')
    case 'failed':
      return [
        `Restart from ${restartFromSetupLabel.value} to ${restartToSetupLabel.value} failed.`,
        'Review the setup target before retrying.',
      ].join(' ')
    case 'live':
      return `Restart complete from ${restartFromSetupLabel.value} to ${restartToSetupLabel.value}.`
    default:
      return null
  }
})
const showStartControls = computed(() =>
  !['confirm-pending', 'in-progress', 'reattaching', 'replaying-history'].includes(activeRestartState.value),
)
const canRestartActive = computed(() => {
  if (!activeSession.value) return false
  return !['confirm-pending', 'in-progress', 'reattaching', 'replaying-history'].includes(activeRestartState.value)
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

watch(
  () => activeSession.value?.id ?? null,
  (id) => {
    if (id) void loadSetupOptionsForSession(id)
  },
  { immediate: true },
)

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
  mobileQuery?.removeEventListener('change', syncIsMobile)
})

async function openWorkspace(id: string): Promise<void> {
  const seq = ++loadSeq
  await store.open(id)
  if (seq !== loadSeq) return
  statuses.syncRestSessions()
  statuses.useWorkspace(id)
  await focusConsoleSurface()
}

async function focusConsoleSurface(): Promise<void> {
  await nextTick()
  consoleSurface.value?.focus()
}

async function onSpawn(): Promise<void> {
  await store.newSession(pickerKind.value)
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
  setupControlsError.value = null
  try {
    if (!activeSetupOptions.value) {
      await loadSetupOptionsForSession(session.id)
      if (!activeSetupOptions.value) {
        store.markRestartFailed(session.id)
        return
      }
    }
    await store.requestRestartConfirmation(session.id)
  } catch (e) {
    store.markRestartFailed(session.id)
    setupControlsError.value = setupErrorMessage(e)
    toast.errorFromCatch('Could not prepare restart', e)
  }
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

async function loadSetupOptionsForSession(sessionId: string): Promise<void> {
  const seq = ++setupOptionsSeq
  setupOptionsLoading.value = true
  setupControlsError.value = null
  try {
    await store.loadSetupOptions(sessionId)
    if (seq !== setupOptionsSeq || activeSession.value?.id !== sessionId) return
    const target = store.selectedRestartTargetFor(sessionId)
    if (target) await store.loadSetupPreview(sessionId, target)
  } catch (e) {
    if (activeSession.value?.id === sessionId) setupControlsError.value = setupErrorMessage(e)
  } finally {
    if (seq === setupOptionsSeq) setupOptionsLoading.value = false
  }
}

async function onSelectRestartTarget(target: AgentSetupReference): Promise<void> {
  const session = activeSession.value
  if (!session) return
  setupControlsError.value = null
  store.selectRestartTarget(session.id, target)
  try {
    const preview = await store.loadSetupPreview(session.id, target)
    if (preview) {
      store.setRestartState(session.id, 'confirm-pending')
    } else {
      store.markRestartFailed(session.id)
    }
  } catch (e) {
    setupControlsError.value = setupErrorMessage(e)
    store.markRestartFailed(session.id)
  }
}

function setupReferenceLabel(setup?: AgentSetupReference | null): string {
  if (!setup) return 'No setup'
  return `${setup.id}@v${setup.version}`
}

function setupErrorMessage(err: unknown): string {
  const status = typeof err === 'object' && err !== null && 'status' in err ? Number(err.status) : null
  if (status === 503) return 'Setup metadata is temporarily unavailable. Try again after the runner is ready.'
  if (status === 409) return 'Setup metadata changed. Refreshing session state.'
  if (status === 422) return 'Selected setup target is not valid for this session.'
  return 'Could not load setup metadata.'
}

function onClearRestartState(): void {
  const session = activeSession.value
  if (!session) return
  store.clearRestartState(session.id)
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
      class="z-10 flex shrink-0 flex-col gap-2 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-dark)] px-3 py-2 sm:px-5"
      data-testid="workspace-view-header"
    >
      <div class="flex min-w-0 items-start gap-3">
        <div class="min-w-0 flex-1">
          <h1 class="truncate text-lg font-bold sm:text-xl">
            {{ store.activeWorkspace?.name ?? 'Loading…' }}
          </h1>
          <p
            v-if="store.activeWorkspace?.repoUrl"
            class="truncate font-mono text-xs text-[var(--color-text-muted)]"
            :title="store.activeWorkspace.repoUrl"
          >
            {{ store.activeWorkspace.repoUrl }}
          </p>
        </div>
        <span
          class="mt-0.5 hidden shrink-0 items-center gap-1.5 rounded px-2 py-1 text-xs text-[var(--color-text-muted)] sm:inline-flex"
          data-testid="workspace-status-summary"
        >
          <span
            class="size-1.5 rounded-full"
            :class="statuses.connectionState === 'open' ? 'bg-green-400' : 'bg-amber-400'"
          />
          {{ statuses.connectionState === 'open' ? 'Live' : activeRestartLabel ?? 'Connecting' }}
        </span>
        <button
          type="button"
          class="ml-auto inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-md border border-[var(--color-surface-border)] bg-[var(--color-surface-elevated)] px-2 text-base text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)] lg:hidden"
          :aria-pressed="isFullscreen"
          data-testid="workspace-fullscreen-toggle"
          :title="isFullscreen ? 'Exit full screen' : 'Full screen'"
          @click="isFullscreen = !isFullscreen"
        >
          {{ isFullscreen ? '✕' : '⛶' }}
        </button>
      </div>
      <nav
        v-if="store.activeWorkspace"
        class="-mb-2 min-w-0 overflow-x-auto pb-2"
        data-testid="workspace-tabs"
        aria-label="Sessions"
      >
        <SessionTabs
          :sessions="consoleSessions"
          :active-id="store.activeSessionId"
          orientation="horizontal"
          @select="onSelectSession"
          @delete="onStopSession"
        />
      </nav>
    </header>

    <main
      class="flex min-h-0 flex-1 overflow-hidden pb-[env(safe-area-inset-bottom)]"
      data-testid="workspace-console-main"
    >
      <section class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2 sm:p-4">
        <div
          ref="consoleSurface"
          tabindex="-1"
          class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--color-surface-border)] bg-[#0b0e14] shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)]"
          data-testid="workspace-hero-terminal"
        >
          <div class="flex min-h-10 shrink-0 items-center gap-2 border-b border-white/10 bg-[#11151c] px-3 py-2">
            <div class="min-w-0">
              <p class="truncate font-mono text-sm text-slate-100" data-testid="workspace-active-session-label">
                {{ activeRailSession?.label ?? 'No session selected' }}
              </p>
              <p class="truncate text-xs text-slate-400">
                {{ activeRailSession?.affordance.description ?? 'Start an agent to attach a terminal.' }}
              </p>
            </div>
          </div>

          <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
            <!-- One terminal per live session, all kept mounted; v-show keeps tab buffers while switching. -->
            <SessionTerminal
              v-for="s in liveSessions"
              v-show="s.id === store.activeSessionId"
              :key="s.id"
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
                  :disabled="store.startingSession"
                  data-testid="workspace-empty-start"
                  @click="onSpawn"
                >
                  {{ spawnButtonLabel }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside
        v-if="store.activeWorkspace"
        id="workspace-sidebar"
        class="flex shrink-0 flex-col border-l border-[var(--color-surface-border)] bg-[var(--color-surface-card)]"
        :class="showSidebar ? 'w-[min(22rem,85vw)]' : 'w-10'"
        data-testid="workspace-sidebar"
        aria-label="Workspace controls"
      >
        <!-- Fold arrow rides the pane's left edge: it moves left as the pane opens. -->
        <button
          type="button"
          class="flex h-11 w-full shrink-0 items-center justify-start px-2 text-base text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)]"
          :aria-expanded="showSidebar"
          aria-controls="workspace-sidebar-body"
          data-testid="workspace-sidebar-toggle"
          :title="showSidebar ? 'Hide controls' : 'Show controls'"
          @click="showSidebar = !showSidebar"
        >
          {{ showSidebar ? '›' : '‹' }}
        </button>
        <div
          v-show="showSidebar"
          id="workspace-sidebar-body"
          class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pt-0"
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
          <SessionStatusRail
          :session="activeRailSession"
          :connection-state="statuses.connectionState"
          :connection-error="statuses.connectionError"
          :restart-label="activeRestartLabel"
          :runner-setup="store.activeWorkspace.runnerSetup ?? null"
        />
        <section
          ref="restartConfirmPanel"
          tabindex="-1"
          class="rounded-md border border-[var(--color-surface-border)] bg-[var(--color-surface)] p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)]"
          data-testid="workspace-lifecycle-controls"
        >
          <h2 class="text-sm font-semibold">Lifecycle</h2>
          <div v-if="restartSetupControlsVisible" class="mt-3 space-y-3" data-testid="workspace-restart-setup-controls">
            <SessionSetupPicker
              :options="activeSetupOptions"
              :selected="activeRestartTarget"
              :loading="setupOptionsLoading"
              :disabled="activeRestartState !== 'confirm-pending' && activeRestartState !== 'failed'"
              :error="setupControlsError"
              @select="onSelectRestartTarget"
            />
            <SessionSetupDiff
              v-if="activeSetupPreview || activeSetupValidationProblem"
              :preview="activeSetupPreview"
              :problem="activeSetupValidationProblem"
              :from="activeSession?.currentSetup ?? null"
              :to="activeRestartTarget"
            />
          </div>
          <div
            v-if="activeRestartState === 'confirm-pending'"
            class="mt-3 space-y-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm"
            data-testid="workspace-restart-confirmation"
          >
            <p class="text-amber-100" data-testid="workspace-restart-confirmation-copy">
              Restart this session from {{ restartFromSetupLabel }} to {{ restartToSetupLabel }} and reattach the
              terminal?
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
          <div
            v-if="activeRestartState !== 'confirm-pending' && restartTransitionCopy"
            class="mt-3 space-y-3 rounded border border-[var(--color-surface-border)] bg-white/5 p-3 text-sm"
            data-testid="workspace-restart-transition"
          >
            <p class="text-[var(--color-text-primary)]">
              {{ restartTransitionCopy }}
            </p>
            <button
              v-if="activeRestartState === 'failed' || activeRestartState === 'live'"
              type="button"
              class="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-[var(--color-surface-border)] px-3 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)]"
              data-testid="workspace-restart-dismiss"
              @click="onClearRestartState"
            >
              Dismiss restart status
            </button>
          </div>
          <div v-if="showStartControls" class="mt-3 grid gap-2">
            <AgentKindPicker v-model="pickerKind" stacked class="min-w-0" />
            <button
              type="button"
              class="inline-flex min-h-10 w-full items-center justify-center whitespace-nowrap rounded-md border border-transparent bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--color-accent-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-dark)] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="store.startingSession"
              data-testid="workspace-new-agent"
              aria-label="Start a new agent session"
              @click="onSpawn"
            >
              {{ spawnButtonLabel }}
            </button>
          </div>
        </section>

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
