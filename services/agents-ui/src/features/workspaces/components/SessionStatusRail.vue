<script setup lang="ts">
import type { SessionConsoleViewModel } from '../stores/sessionConsoleViewModels'
import type { WorkspaceRunnerSetup } from '../types'
import { computed, useSlots } from 'vue'
import SessionStatusChip from './SessionStatusChip.vue'

type ConnectionState = 'idle' | 'connecting' | 'open' | 'error'

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
  restartLabel?: string | null
  runnerSetup?: WorkspaceRunnerSetup | null
}

const props = withDefaults(defineProps<Props>(), {
  connectionState: 'idle',
  connectionError: null,
  restartLabel: null,
  runnerSetup: null,
})

const slots = useSlots()

const connectionCopy: Record<ConnectionState, { label: string; detail: string; shape: string }> = {
  idle: { label: 'Stream idle', detail: 'Status stream is idle', shape: 'ring' },
  connecting: { label: 'Connecting', detail: 'Status stream is connecting', shape: 'ring' },
  open: { label: 'Connected', detail: 'Status stream is connected', shape: 'dot' },
  error: { label: 'Disconnected', detail: 'Status stream is disconnected', shape: 'diamond' },
}

const connectionToneClass: Record<ConnectionState, string> = {
  idle: 'border-[var(--color-surface-border)] bg-white/5 text-[var(--color-text-muted)]',
  connecting: 'border-sky-500/35 bg-sky-500/15 text-sky-200',
  open: 'border-emerald-500/35 bg-emerald-500/15 text-emerald-200',
  error: 'border-red-500/40 bg-red-500/15 text-red-200',
}

const shapeClass: Record<string, string> = {
  dot: 'rounded-full bg-current',
  ring: 'rounded-full border-2 border-current bg-transparent',
  diamond: 'rotate-45 rounded-[1px] bg-current',
}

const lastStatusUpdate = computed(() => props.session?.lastStatusUpdate ?? props.session?.updatedAt ?? null)
const formattedLastUpdate = computed(() => formatTimestamp(lastStatusUpdate.value))
const epochGeneration = computed(() => {
  if (!props.session) return 'Epoch - / Gen -'
  const epoch = props.session.epoch ?? '-'
  const generation = props.session.generation ?? '-'
  return `Epoch ${epoch} / Gen ${generation}`
})
const sessionSetupLabel = computed(() => props.session?.setupLabel ?? 'No setup')
const runnerSetupLabel = computed(() => {
  const setup = props.runnerSetup
  if (!setup) return 'No runner setup'
  const current = `${setup.current.id}@v${setup.current.version}`
  const pending = setup.pending ? ` -> ${setup.pending.id}@v${setup.pending.version}` : ''
  return `${current}${pending} / Gen ${setup.generation} / ${runnerOperationLabel(setup.operation)}`
})
const connection = computed(() => connectionCopy[props.connectionState])
const connectionLabel = computed(() => props.connectionError ?? connection.value.detail)
const hasRestartProgress = computed(() => Boolean(props.restartLabel) || Boolean(slots['restart-progress']))
const railLabel = computed(() => {
  if (!props.session) return 'No active session status'
  return [
    `${props.session.label}: ${props.session.affordance.ariaLabel}`,
    props.session.kindLabel,
    epochGeneration.value,
    sessionSetupLabel.value,
    connectionLabel.value,
  ].join(', ')
})

function runnerOperationLabel(operation: WorkspaceRunnerSetup['operation']): string {
  if (operation === 'RESTARTING') return 'Restarting setup'
  if (operation === 'FAILED') return 'Setup failed'
  return 'Idle'
}

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
      <SessionStatusChip :session="session" compact />
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
      <div class="min-h-10 rounded border border-[var(--color-surface-border)] bg-white/5 px-2 py-1.5">
        <dt class="text-[var(--color-text-muted)]">Session setup</dt>
        <dd class="truncate font-mono text-[var(--color-text-primary)]" data-testid="session-status-rail-setup">
          {{ sessionSetupLabel }}
        </dd>
      </div>
      <div class="min-h-10 rounded border border-[var(--color-surface-border)] bg-white/5 px-2 py-1.5">
        <dt class="text-[var(--color-text-muted)]">Runner setup</dt>
        <dd class="truncate font-mono text-[var(--color-text-primary)]" data-testid="session-status-rail-runner-setup">
          {{ runnerSetupLabel }}
        </dd>
      </div>
    </dl>

    <div
      class="flex min-h-9 items-center gap-2 rounded border px-2 py-1.5 text-xs"
      :class="connectionToneClass[connectionState]"
      data-testid="session-status-rail-connection"
      :data-state="connectionState"
      :aria-label="connectionLabel"
    >
      <span class="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
        <span class="block h-2.5 w-2.5" :class="shapeClass[connection.shape]" />
      </span>
      <span class="shrink-0 font-medium">{{ connection.label }}</span>
      <span v-if="connectionError" class="min-w-0 truncate text-[var(--color-text-muted)]">
        {{ connectionError }}
      </span>
    </div>

    <div
      v-if="hasRestartProgress"
      class="min-h-9 rounded border border-[var(--color-surface-border)] bg-white/5 px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
      data-testid="session-status-rail-restart"
    >
      <slot name="restart-progress" :session="session">
        <span>{{ restartLabel }}</span>
      </slot>
    </div>
  </section>
</template>
