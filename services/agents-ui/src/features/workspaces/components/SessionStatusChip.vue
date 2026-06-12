<script setup lang="ts">
import type {
  SessionConsoleViewModel,
  SessionStatusAffordance,
  SessionStatusShape,
  SessionStatusTone,
} from '../stores/sessionConsoleViewModels'
import { computed } from 'vue'

interface Props {
  session: SessionConsoleViewModel
  compact?: boolean
  showKind?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
  showKind: false,
})

const toneClass: Record<SessionStatusTone, string> = {
  neutral: 'border-[var(--color-surface-border)] bg-white/5 text-[var(--color-text-muted)]',
  info: 'border-sky-500/35 bg-sky-500/15 text-sky-200',
  success: 'border-emerald-500/35 bg-emerald-500/15 text-emerald-200',
  warning: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  danger: 'border-red-500/40 bg-red-500/15 text-red-200',
}

const shapeClass: Record<SessionStatusShape, string> = {
  dot: 'rounded-full bg-current',
  ring: 'rounded-full border-2 border-current bg-transparent',
  square: 'rounded-[2px] bg-current',
  diamond: 'rotate-45 rounded-[1px] bg-current',
}

const iconGlyph: Record<SessionStatusAffordance['icon'], string> = {
  'loader': '...',
  'pause': 'II',
  'play': '>',
  'square': '[]',
  'triangle-alert': '!',
}

const label = computed(() => {
  const parts = [props.session.label, props.session.affordance.ariaLabel]
  if (props.session.idle) parts.push('idle')
  return parts.join(': ')
})

const chipClass = computed(() => [
  'inline-flex shrink-0 items-center border font-medium leading-none',
  'focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--color-accent-light)]',
  props.compact
    ? 'h-7 min-w-[6rem] gap-1.5 rounded px-2 text-[0.6875rem]'
    : 'h-8 min-w-[8rem] gap-2 rounded-md px-2.5 text-xs',
  toneClass[props.session.affordance.tone],
])
</script>

<template>
  <span
    :class="chipClass"
    role="status"
    :aria-label="label"
    :title="session.affordance.description"
    data-testid="session-status-chip"
    :data-status="session.status"
    :data-tone="session.affordance.tone"
    :data-shape="session.affordance.shape"
    :data-icon="session.affordance.icon"
    :data-idle="session.idle ? 'true' : undefined"
  >
    <span
      class="flex h-4 w-4 shrink-0 items-center justify-center"
      aria-hidden="true"
      data-testid="session-status-chip-shape"
    >
      <span class="block h-2.5 w-2.5" :class="shapeClass[session.affordance.shape]" />
    </span>
    <span
      class="flex h-4 w-5 shrink-0 items-center justify-center font-mono text-[0.625rem] font-bold"
      aria-hidden="true"
      data-testid="session-status-chip-icon"
    >
      {{ iconGlyph[session.affordance.icon] ?? '?' }}
    </span>
    <span v-if="showKind" class="shrink-0 uppercase tracking-normal text-[var(--color-text-muted)]">
      {{ session.kind }}
    </span>
    <span class="min-w-0 truncate" data-testid="session-status-chip-text">
      {{ session.affordance.text }}
    </span>
  </span>
</template>
