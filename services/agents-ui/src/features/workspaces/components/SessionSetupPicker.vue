<script setup lang="ts">
import type { AgentSetupReference, SetupTargetOption, SetupTargetOptions } from '../types'
import { computed } from 'vue'

interface Props {
  options: SetupTargetOptions | null
  selected: AgentSetupReference | null
  loading?: boolean
  disabled?: boolean
  error?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  disabled: false,
  error: null,
})

const emit = defineEmits<{
  select: [target: AgentSetupReference]
}>()

const entries = computed(() => props.options?.options ?? [])
const currentLabel = computed(() => setupReferenceLabel(props.options?.current ?? null))
const pendingLabel = computed(() => setupReferenceLabel(props.options?.pending ?? null))

function setupReferenceLabel(setup?: AgentSetupReference | null): string {
  if (!setup) return 'No setup'
  return `${setup.id}@v${setup.version}`
}

function optionId(option: SetupTargetOption): string {
  return `${option.setup.setup.id}@v${option.setup.setup.version}`
}

function optionTestId(option: SetupTargetOption): string {
  const id = option.setup.setup.id.replace(/[^\w-]+/g, '-')
  return `setup-picker-option-${id}-${option.setup.setup.version}`
}

function isSelected(option: SetupTargetOption): boolean {
  return props.selected?.id === option.setup.setup.id && props.selected.version === option.setup.setup.version
}

function selectOption(option: SetupTargetOption): void {
  if (props.disabled || !option.setup.selectable || !option.validation.valid) return
  emit('select', option.setup.setup)
}
</script>

<template>
  <section
    class="rounded-md border border-[var(--color-surface-border)] bg-white/5 p-3 text-sm"
    data-testid="session-setup-picker"
    aria-label="Restart setup target"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)]">Restart setup</h3>
        <p class="mt-1 truncate font-mono text-xs text-[var(--color-text-muted)]" data-testid="setup-picker-current">
          Current: {{ currentLabel }}
        </p>
        <p
          v-if="options?.pending"
          class="mt-1 truncate font-mono text-xs text-amber-200"
          data-testid="setup-picker-pending"
        >
          Pending: {{ pendingLabel }}
        </p>
      </div>
      <span
        v-if="loading"
        class="shrink-0 rounded border border-sky-500/35 bg-sky-500/15 px-2 py-1 text-xs text-sky-200"
        data-testid="setup-picker-loading"
      >
        Loading
      </span>
    </div>

    <p
      v-if="error"
      class="mt-3 rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-xs text-red-200"
      data-testid="setup-picker-error"
    >
      {{ error }}
    </p>

    <fieldset class="mt-3 space-y-2" :disabled="disabled || loading">
      <legend class="sr-only">Available setup targets</legend>
      <p v-if="entries.length === 0" class="text-xs text-[var(--color-text-muted)]" data-testid="setup-picker-empty">
        No setup targets available.
      </p>
      <label
        v-for="option in entries"
        :key="optionId(option)"
        class="flex min-w-0 gap-2 rounded border border-[var(--color-surface-border)] bg-[var(--color-surface)] p-2 text-left"
        :class="option.setup.selectable && option.validation.valid ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'"
        :data-testid="optionTestId(option)"
      >
        <input
          type="radio"
          class="mt-1 shrink-0"
          name="session-setup-target"
          :checked="isSelected(option)"
          :disabled="disabled || loading || !option.setup.selectable || !option.validation.valid"
          :aria-label="`Select ${option.setup.displayName}`"
          @change="selectOption(option)"
        />
        <span class="min-w-0 flex-1">
          <span class="flex min-w-0 items-center gap-2">
            <span class="truncate font-medium text-[var(--color-text-primary)]">{{ option.setup.displayName }}</span>
            <span class="shrink-0 font-mono text-xs text-[var(--color-text-muted)]">
              {{ setupReferenceLabel(option.setup.setup) }}
            </span>
          </span>
          <span v-if="option.setup.description" class="mt-1 block text-xs text-[var(--color-text-muted)]">
            {{ option.setup.description }}
          </span>
          <span
            v-if="!option.setup.selectable && option.setup.unavailableReason"
            class="mt-1 block text-xs text-amber-200"
          >
            {{ option.setup.unavailableReason }}
          </span>
          <span v-if="!option.validation.valid" class="mt-1 block text-xs text-red-200">
            {{ option.validation.issues[0]?.message ?? 'Setup target is not valid for this workspace.' }}
          </span>
          <span v-else-if="option.validation.warnings.length > 0" class="mt-1 block text-xs text-amber-200">
            {{ option.validation.warnings[0]?.message }}
          </span>
        </span>
      </label>
    </fieldset>
  </section>
</template>
