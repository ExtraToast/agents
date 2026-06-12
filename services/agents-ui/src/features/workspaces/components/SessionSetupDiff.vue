<script setup lang="ts">
import type { AgentSetupDiffChange, AgentSetupReference, AgentSetupValidationProblem, SetupPreview } from '../types'
import { computed } from 'vue'

interface Props {
  preview: SetupPreview | null
  problem?: AgentSetupValidationProblem | null
  from?: AgentSetupReference | null
  to?: AgentSetupReference | null
}

const props = withDefaults(defineProps<Props>(), {
  problem: null,
  from: null,
  to: null,
})

const fromLabel = computed(() => setupReferenceLabel(props.preview?.current ?? props.preview?.diff?.from ?? props.from))
const toLabel = computed(() => setupReferenceLabel(props.preview?.target ?? props.preview?.diff?.to ?? props.to))
const changes = computed(() => props.preview?.diff?.changes ?? [])
const issues = computed(() => props.problem?.errors ?? props.preview?.validation.issues ?? [])
const warnings = computed(() => props.preview?.validation.warnings ?? [])
const hasNoChanges = computed(() => props.preview?.diff?.hasChanges === false || changes.value.length === 0)

function setupReferenceLabel(setup?: AgentSetupReference | null): string {
  if (!setup) return 'No setup'
  return `${setup.id}@v${setup.version}`
}

function changeValue(change: AgentSetupDiffChange, side: 'from' | 'to'): string {
  if (change.redacted) return 'Redacted'
  const value = side === 'from' ? change.fromValue : change.toValue
  return value ?? 'Unset'
}

function issueKey(issue: { code?: string; field?: string; message: string }): string {
  return `${issue.field ?? issue.code ?? 'issue'}-${issue.message}`
}
</script>

<template>
  <section
    class="rounded-md border border-[var(--color-surface-border)] bg-white/5 p-3 text-sm"
    data-testid="session-setup-diff"
    aria-label="Setup restart diff"
  >
    <div class="grid gap-2 sm:grid-cols-2">
      <div class="min-w-0 rounded border border-[var(--color-surface-border)] bg-[var(--color-surface)] px-2 py-1.5">
        <p class="text-xs text-[var(--color-text-muted)]">From</p>
        <p class="truncate font-mono text-xs text-[var(--color-text-primary)]" data-testid="setup-diff-from">
          {{ fromLabel }}
        </p>
      </div>
      <div class="min-w-0 rounded border border-[var(--color-surface-border)] bg-[var(--color-surface)] px-2 py-1.5">
        <p class="text-xs text-[var(--color-text-muted)]">To</p>
        <p class="truncate font-mono text-xs text-[var(--color-text-primary)]" data-testid="setup-diff-to">
          {{ toLabel }}
        </p>
      </div>
    </div>

    <p
      v-if="preview && hasNoChanges"
      class="mt-3 text-xs text-[var(--color-text-muted)]"
      data-testid="setup-diff-empty"
    >
      No setup field changes.
    </p>
    <dl v-else-if="changes.length > 0" class="mt-3 divide-y divide-[var(--color-surface-border)]">
      <div
        v-for="change in changes"
        :key="change.field"
        class="grid gap-2 py-2 text-xs sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]"
        data-testid="setup-diff-change"
      >
        <dt class="min-w-0 truncate font-medium text-[var(--color-text-primary)]">{{ change.field }}</dt>
        <dd class="min-w-0 truncate font-mono text-[var(--color-text-muted)]">
          {{ changeValue(change, 'from') }}
        </dd>
        <dd class="min-w-0 truncate font-mono text-[var(--color-text-primary)]">
          {{ changeValue(change, 'to') }}
        </dd>
      </div>
    </dl>

    <div v-if="issues.length > 0" class="mt-3 space-y-1" data-testid="setup-diff-issues">
      <p
        v-for="issue in issues"
        :key="issueKey(issue)"
        class="rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-xs text-red-200"
      >
        {{ issue.message }}
      </p>
    </div>
    <div v-if="warnings.length > 0" class="mt-3 space-y-1" data-testid="setup-diff-warnings">
      <p
        v-for="warning in warnings"
        :key="`${warning.code}-${warning.message}`"
        class="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-100"
      >
        {{ warning.message }}
      </p>
    </div>
  </section>
</template>
