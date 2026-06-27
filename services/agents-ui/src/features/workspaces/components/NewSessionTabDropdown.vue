<script setup lang="ts">
import type { AgentKind } from '../types'
import { Dropdown } from '@/lib/vueWebCommons'

interface Props {
  starting?: boolean
}

withDefaults(defineProps<Props>(), {
  starting: false,
})

const emit = defineEmits<{
  select: [kind: AgentKind]
}>()

const options: { kind: AgentKind; label: string; testId: string }[] = [
  { kind: 'CLAUDE', label: 'Claude', testId: 'workspace-new-session-option-claude' },
  { kind: 'CODEX', label: 'Codex', testId: 'workspace-new-session-option-codex' },
  { kind: 'SHELL', label: 'Shell', testId: 'workspace-new-session-option-shell' },
]

function onSelect(kind: AgentKind, close: () => void): void {
  close()
  emit('select', kind)
}
</script>

<template>
  <Dropdown
    trigger-label="Start a new agent session"
    align="left"
  >
    <!-- The commons Dropdown renders its own <button> wrapper that toggles the
         menu, so the trigger slot must be a non-button element (no nested
         buttons) and just supplies the tab-styled visual. -->
    <template #trigger="{ open }">
      <span
        class="relative flex h-full cursor-pointer items-center justify-center rounded-t-md border border-t-2 border-[var(--color-surface-border)] border-t-transparent bg-[var(--color-surface)] px-3 py-2 text-sm leading-normal transition-colors"
        :class="open ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'"
        data-testid="workspace-new-session"
      >
        {{ starting ? '…' : '+' }}
      </span>
    </template>

    <template #default="{ close }">
      <ul
        role="menu"
        class="min-w-[8rem] rounded-md border border-[var(--color-surface-border)] bg-[var(--color-surface-elevated)] py-1 shadow-lg"
      >
        <li
          v-for="option in options"
          :key="option.kind"
          role="presentation"
        >
          <button
            type="button"
            role="menuitem"
            class="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-border)] focus:outline-none focus-visible:bg-[var(--color-surface-border)]"
            :data-testid="option.testId"
            @click="onSelect(option.kind, close)"
          >
            {{ option.label }}
          </button>
        </li>
      </ul>
    </template>
  </Dropdown>
</template>
