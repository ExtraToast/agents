<script setup lang="ts">
import type { AgentSession } from '../types'
import { computed, nextTick, ref, watch } from 'vue'
import { useSessionLabelsStore } from '../stores/sessionLabels'

interface Props {
  sessions: AgentSession[]
  activeId: string | null
  orientation?: 'horizontal' | 'vertical'
}

const props = withDefaults(defineProps<Props>(), {
  orientation: 'horizontal',
})

const emit = defineEmits<{
  select: [id: string]
}>()

const labels = useSessionLabelsStore()
const isVertical = computed(() => props.orientation === 'vertical')
const tabRefs = new Map<string, HTMLElement>()
const rovingId = ref<string | null>(null)

function tabLabel(s: AgentSession): string {
  return labels.labelFor(s.id) ?? s.id.slice(0, 8)
}

function tabPanelId(s: AgentSession): string {
  return `session-panel-${s.id}`
}

function setupLabel(s: AgentSession): string | null {
  const current = s.currentSetup ? `${s.currentSetup.id}@v${s.currentSetup.version}` : null
  const pending = s.pendingSetup ? `${s.pendingSetup.id}@v${s.pendingSetup.version}` : null
  if (pending) return current ? `${current} -> ${pending}` : pending
  return current
}

function isSelected(s: AgentSession): boolean {
  return props.activeId === s.id
}

function isRoving(s: AgentSession): boolean {
  return rovingId.value === s.id
}

function setTabRef(id: string, el: unknown): void {
  if (el instanceof HTMLElement) {
    tabRefs.set(id, el)
    return
  }
  tabRefs.delete(id)
}

watch(
  () => [props.sessions, props.activeId] as const,
  () => {
    const ids = props.sessions.map((s) => s.id)
    if (props.activeId && ids.includes(props.activeId)) {
      rovingId.value = props.activeId
      return
    }
    if (rovingId.value && ids.includes(rovingId.value)) return
    rovingId.value = ids[0] ?? null
  },
  { immediate: true },
)

// Right-click (or double-click) a tab to rename it inline. The default
// label is left as the input's placeholder rather than its value so a
// fresh name can be typed without first clearing the id; an empty
// commit clears any custom label and reverts to the default.
const editingId = ref<string | null>(null)
const draft = ref('')

async function startEdit(s: AgentSession): Promise<void> {
  rovingId.value = s.id
  editingId.value = s.id
  draft.value = labels.labelFor(s.id) ?? ''
  await nextTick()
}

function commit(id: string): void {
  if (editingId.value !== id) return
  labels.rename(id, draft.value)
  editingId.value = null
}

function cancel(): void {
  editingId.value = null
}

function focusInput(el: unknown): void {
  if (el instanceof HTMLInputElement) {
    el.focus()
    el.select()
  }
}

async function focusTab(id: string): Promise<void> {
  rovingId.value = id
  await nextTick()
  tabRefs.get(id)?.focus()
}

function selectTab(id: string): void {
  rovingId.value = id
  emit('select', id)
}

async function onTabKeydown(event: KeyboardEvent, id: string): Promise<void> {
  if (editingId.value === id) return
  const current = props.sessions.findIndex((s) => s.id === id)
  if (current === -1) return

  let next = current
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    next = (current + 1) % props.sessions.length
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    next = (current - 1 + props.sessions.length) % props.sessions.length
  } else if (event.key === 'Home') {
    next = 0
  } else if (event.key === 'End') {
    next = props.sessions.length - 1
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    selectTab(id)
    return
  } else {
    return
  }

  event.preventDefault()
  const nextId = props.sessions[next]?.id
  if (!nextId) return
  selectTab(nextId)
  await focusTab(nextId)
}

function sessionShellClasses(s: AgentSession): string[] {
  const active = props.activeId === s.id
  const base = [
    'min-w-0 flex-1 items-center gap-2 text-sm transition-colors',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)]',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-dark)]',
  ].join(' ')

  if (isVertical.value) {
    return [
      base,
      'flex rounded-md border px-3 py-2 text-left',
      active
        ? 'border-[var(--color-accent-light)] bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)]'
        : 'border-[var(--color-surface-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-accent-light)] hover:text-[var(--color-text-primary)]',
    ]
  }

  return [
    base,
    'flex rounded-t-md border-b-2 px-3 py-2.5',
    active
      ? 'border-[var(--color-accent-light)] bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)]'
      : 'border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]',
  ]
}
</script>

<template>
  <nav :class="isVertical ? 'space-y-2' : 'min-w-0'" data-testid="session-tabs" aria-label="Agent sessions">
    <p v-if="props.sessions.length === 0" class="text-sm italic text-[var(--color-text-muted)]">No sessions yet.</p>
    <ul
      v-else
      :class="isVertical ? 'space-y-2' : 'flex gap-1 overflow-x-auto overflow-y-hidden px-1 pt-1'"
      data-testid="session-tabs-list"
      role="tablist"
      :aria-orientation="isVertical ? 'vertical' : 'horizontal'"
    >
      <li
        v-for="s in props.sessions"
        :key="s.id"
        class="flex min-w-0 items-stretch gap-1"
        :class="isVertical ? '' : 'w-[15rem] shrink-0'"
        role="presentation"
      >
        <div
          :id="`session-tab-control-${s.id}`"
          :ref="(el) => setTabRef(s.id, el)"
          role="tab"
          :aria-selected="isSelected(s) ? 'true' : 'false'"
          :aria-controls="tabPanelId(s)"
          :tabindex="isRoving(s) ? 0 : -1"
          :class="sessionShellClasses(s)"
          :data-testid="`session-tab-${s.id}`"
          @click="selectTab(s.id)"
          @keydown="onTabKeydown($event, s.id)"
          @contextmenu.prevent="startEdit(s)"
          @dblclick.prevent="startEdit(s)"
        >
          <span
            class="size-2 shrink-0 rounded-full"
            :class="s.status === 'RUNNING' ? 'bg-green-400' : 'bg-[var(--color-text-muted)]'"
            :title="`${s.kind} · ${s.status}`"
            :aria-label="`${s.kind}, ${s.status}`"
          />
          <template v-if="editingId === s.id">
            <input
              :ref="(el) => focusInput(el)"
              v-model="draft"
              type="text"
              :placeholder="s.id.slice(0, 8)"
              data-testid="session-tab-rename"
              class="min-w-0 flex-1 border-b border-[var(--color-accent-light)] bg-transparent font-mono text-sm focus:outline-none"
              @click.stop
              @keydown.stop
              @keydown.enter.prevent="commit(s.id)"
              @keydown.esc.prevent="cancel"
              @blur="commit(s.id)"
            />
          </template>
          <span
            v-else
            class="min-w-0 flex-1 truncate font-mono"
            :title="setupLabel(s) ?? s.id"
            :data-testid="`session-tab-label-${s.id}`"
          >{{ tabLabel(s) }}</span>
          <button
            v-if="editingId !== s.id"
            type="button"
            class="shrink-0 rounded p-1 text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)]"
            :aria-label="`Rename session ${tabLabel(s)}`"
            :data-testid="`session-tab-rename-${s.id}`"
            @click.stop="startEdit(s)"
            @keydown.stop
          >
            ✎
          </button>
        </div>
      </li>
    </ul>
  </nav>
</template>
