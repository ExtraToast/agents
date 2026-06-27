<script setup lang="ts">
import type { SessionConsoleViewModel } from '../stores/sessionConsoleViewModels'
import type { WorkspaceRunnerImage } from '../types'
import { computed } from 'vue'

type ConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'error'

interface RailSession extends SessionConsoleViewModel {
  lastStatusUpdate?: string | null
  updatedAt?: string | null
  epoch?: number | null
  generation?: number | null
}

interface Props {
  session: RailSession | null
  connectionState?: ConnectionState
  connectionError?: string | null
  runnerImage?: WorkspaceRunnerImage | null
}

const props = withDefaults(defineProps<Props>(), {
  connectionState: 'idle',
  connectionError: null,
  runnerImage: null,
})

const emit = defineEmits<{ (e: 'updateRunner'): void }>()

const connectionCopy: Record<ConnectionState, string> = {
  idle: 'Status stream is idle',
  connecting: 'Status stream is connecting',
  reconnecting: 'Status stream is reconnecting',
  open: 'Status stream is connected',
  error: 'Status stream is disconnected',
}

const lastStatusUpdate = computed(() => props.session?.lastStatusUpdate ?? props.session?.updatedAt ?? null)
const formattedLastUpdate = computed(() => formatTimestamp(lastStatusUpdate.value))
const epochGeneration = computed(() => {
  if (!props.session) return 'Epoch - / Gen -'
  const epoch = props.session.epoch ?? '-'
  const generation = props.session.generation ?? '-'
  return `Epoch ${epoch} / Gen ${generation}`
})
const runnerImageVersion = computed(() => props.runnerImage?.version ?? null)
const runnerUpgradeAvailable = computed(() => props.runnerImage?.upgradeAvailable === true)
const runnerImageLabel = computed(() => {
  const version = runnerImageVersion.value
  if (!version) return 'No runner'
  return runnerUpgradeAvailable.value ? `${version} · update available` : `${version} · up to date`
})
const isConnected = computed(() => props.connectionState === 'open')
const isRunning = computed(() => props.session?.status === 'RUNNING')
const connectionLabel = computed(() => props.connectionError ?? connectionCopy[props.connectionState])
// One status chip: Running (green) wins; otherwise Connected (orange). Nothing if neither.
const statusChip = computed<{ tone: 'running' | 'connected'; label: string } | null>(() => {
  if (isRunning.value) return { tone: 'running', label: 'Running' }
  if (isConnected.value) return { tone: 'connected', label: 'Connected' }
  return null
})
const railLabel = computed(() => {
  if (!props.session) return 'No active session status'
  return [
    `${props.session.label}: ${props.session.affordance.ariaLabel}`,
    props.session.kindLabel,
    epochGeneration.value,
    runnerImageLabel.value,
    connectionLabel.value,
  ].join(', ')
})

function formatTimestamp(value: string | null): string {
  if (!value) return 'No status update'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}
</script>

<template>
  <section
    class="grid min-h-[6.5rem] min-w-[18rem] grid-cols-[minmax(0,1fr)] gap-3 rounded-md border border-[var(--color-surface-border)] bg-[var(--color-surface)] p-3 text-sm"
    data-testid="session-status-rail"
    :aria-label="railLabel"
  >
    <div v-if="session" class="flex min-h-8 min-w-0 items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate font-mono text-sm text-[var(--color-text-primary)]" data-testid="session-status-rail-label">
          {{ session.label }}
        </p>
        <p class="truncate text-xs text-[var(--color-text-muted)]" data-testid="session-status-rail-kind">
          {{ session.kindLabel }}
        </p>
      </div>
      <div class="ml-auto flex shrink-0 items-center">
        <span
          v-if="statusChip"
          class="inline-flex h-7 shrink-0 items-center gap-1.5 rounded border px-2 text-[0.6875rem] font-medium leading-none"
          :class="
            statusChip.tone === 'running'
              ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300'
              : 'border-orange-500/35 bg-orange-500/10 text-orange-300'
          "
          :data-testid="`session-status-rail-${statusChip.tone}-chip`"
          :data-state="connectionState"
          :aria-label="statusChip.tone === 'running' ? 'Session is running' : connectionLabel"
          :title="statusChip.tone === 'running' ? 'Session is running' : connectionLabel"
        >
          <span class="block size-2 rounded-full bg-current" aria-hidden="true" />
          <span>{{ statusChip.label }}</span>
        </span>
      </div>
    </div>
    <p v-else class="min-h-8 text-sm text-[var(--color-text-muted)]" data-testid="session-status-rail-empty">
      No active session.
    </p>

    <dl class="grid grid-cols-2 gap-2 text-xs">
      <div class="min-h-10 rounded border border-[var(--color-surface-border)] bg-white/5 px-2 py-1.5">
        <dt class="text-[var(--color-text-muted)]">Last update</dt>
        <dd class="truncate font-mono text-[var(--color-text-primary)]" data-testid="session-status-rail-updated">
          {{ formattedLastUpdate }}
        </dd>
      </div>
      <div class="min-h-10 rounded border border-[var(--color-surface-border)] bg-white/5 px-2 py-1.5">
        <dt class="text-[var(--color-text-muted)]">Epoch</dt>
        <dd class="truncate font-mono text-[var(--color-text-primary)]" data-testid="session-status-rail-epoch">
          {{ epochGeneration }}
        </dd>
      </div>
      <div
        class="col-span-2 flex min-h-10 items-center justify-between gap-2 rounded border px-2 py-1.5"
        :class="runnerUpgradeAvailable
          ? 'border-amber-500/35 bg-amber-500/10'
          : 'border-[var(--color-surface-border)] bg-white/5'"
      >
        <div class="min-w-0">
          <dt class="text-[var(--color-text-muted)]">Runner</dt>
          <dd class="truncate font-mono text-[var(--color-text-primary)]" data-testid="session-status-rail-runner-image">
            {{ runnerImageLabel }}
          </dd>
        </div>
        <button
          v-if="runnerUpgradeAvailable"
          type="button"
          class="shrink-0 rounded bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-400"
          data-testid="session-status-rail-update-runner"
          @click="emit('updateRunner')"
        >
          Update runner
        </button>
      </div>
    </dl>
  </section>
</template>
