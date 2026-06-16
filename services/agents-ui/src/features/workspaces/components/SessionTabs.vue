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
  delete: [id: string]
}>()

const labels = useSessionLabelsStore()
const isVertical = computed(() => props.orientation === 'vertical')

const kindBadge: Record<AgentSession['kind'], string> = {
  CLAUDE: 'bg-orange-500/20 text-orange-300',
  CODEX: 'bg-emerald-500/20 text-emerald-300',
  SHELL: 'bg-gray-500/20 text-[var(--color-text-primary)]',
}
const tabRefs = new Map<string, HTMLElement>()
const rovingId = ref<string | null>(null)

const kindLabel: Record<AgentSession['kind'], string> = {
  CLAUDE: 'Claude',
  CODEX: 'Codex',
  SHELL: 'Shell',
}

// Default name reads like claude-1 / codex-2 / shell-1: the agent kind plus its
// 1-based position among same-kind sessions, so tabs are recognisable before
// anyone renames them.
function defaultName(s: AgentSession): string {
  const index = props.sessions.filter((other) => other.kind === s.kind).findIndex((other) => other.id === s.id)
  return `${s.kind.toLowerCase()}-${index + 1}`
}

function tabLabel(s: AgentSession): string {
  return labels.labelFor(s.id) ?? defaultName(s)
}

function tabPanelId(s: AgentSession): string {
  return `session-panel-${s.id}`
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

// The ref callback re-fires on every re-render, and v-model re-renders the
// input on each keystroke. Only focus + select the text when the input first
// gains focus, otherwise typing would reselect everything and overwrite the
// previous character on every input.
function focusInput(el: unknown): void {
  if (el instanceof HTMLInputElement && document.activeElement !== el) {
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

  // Folder-style tabs: rounded top corners, square bottom, with visible top and
  // side borders so each tab is distinct from the surface. The active tab takes
  // the terminal's background and drops its bottom border so it merges into the
  // console below; its accent top edge marks it active. Heights match because
  // both states reserve a 2px top border.
  return [
    base,
    'relative flex rounded-t-md border border-t-2 px-3 py-2',
    active
      ? 'border-[var(--color-surface-border)] border-t-[var(--color-accent-light)] border-b-transparent bg-[#0b0e14] text-slate-100'
      : 'border-[var(--color-surface-border)] border-t-transparent bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
  ]
}
</script>

<template>
  <nav :class="isVertical ? 'space-y-2' : 'min-w-0'" data-testid="session-tabs" aria-label="Agent sessions">
    <p v-if="props.sessions.length === 0" class="text-sm italic text-[var(--color-text-muted)]">No sessions yet.</p>
    <ul
      v-else
      :class="isVertical ? 'space-y-2' : 'tabs-scroll flex overflow-x-auto overflow-y-hidden'"
      data-testid="session-tabs-list"
      role="tablist"
      :aria-orientation="isVertical ? 'vertical' : 'horizontal'"
    >
      <li
        v-for="s in props.sessions"
        :key="s.id"
        class="flex min-w-0"
        :class="isVertical ? '' : 'w-[13rem] shrink-0'"
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
            class="relative flex size-6 shrink-0 items-center justify-center rounded"
            :class="kindBadge[s.kind]"
            :aria-label="kindLabel[s.kind]"
            :title="kindLabel[s.kind]"
            :data-testid="`session-tab-kind-${s.id}`"
            :data-kind="s.kind"
          >
            <span
              class="absolute -right-1 -top-1 size-2.5 rounded-full ring-2 ring-[var(--color-surface-dark)]"
              :class="s.status === 'RUNNING'
                ? 'bg-green-400'
                : s.status === 'FAILED'
                  ? 'bg-red-400'
                  : 'bg-[var(--color-text-muted)]'"
              :aria-label="`Status: ${s.status}`"
              :title="`Status: ${s.status}`"
            />
            <svg
              v-if="s.kind === 'CLAUDE'"
              class="size-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />
            </svg>
            <svg
              v-else-if="s.kind === 'CODEX'"
              class="size-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2 20.66 7v10L12 22 3.34 17V7L12 2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <svg
              v-else
              class="size-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M5 7l5 5-5 5M13 17h6" />
            </svg>
          </span>
          <template v-if="editingId === s.id">
            <input
              :ref="(el) => focusInput(el)"
              v-model="draft"
              type="text"
              :placeholder="defaultName(s)"
              data-testid="session-tab-rename"
              class="min-w-0 flex-1 rounded bg-[var(--color-surface-dark)] px-1 py-0.5 font-mono text-sm text-[var(--color-text-primary)] ring-1 ring-[var(--color-accent-light)] focus:outline-none"
              @click.stop
              @keydown.stop
              @keydown.enter.prevent="commit(s.id)"
              @keydown.esc.prevent="cancel"
              @blur="commit(s.id)"
            />
          </template>
          <!-- The name is the rename affordance: hovering it reveals an input
               box; clicking turns it into a focused text field (no pencil). -->
          <span
            v-else
            class="min-w-0 flex-1 cursor-text truncate rounded px-1 py-0.5 font-mono transition-colors hover:bg-white/10 hover:ring-1 hover:ring-inset hover:ring-[var(--color-surface-border)]"
            :data-testid="`session-tab-rename-${s.id}`"
            :title="`Rename ${tabLabel(s)}`"
            @click.stop="startEdit(s)"
          >{{ tabLabel(s) }}</span>
          <button
            v-if="editingId !== s.id"
            type="button"
            class="flex size-6 shrink-0 items-center justify-center rounded text-base leading-none text-[var(--color-text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            :aria-label="`Delete session ${tabLabel(s)}`"
            :title="`Delete session ${tabLabel(s)}`"
            :data-testid="`session-tab-delete-${s.id}`"
            @click.stop="emit('delete', s.id)"
            @keydown.stop
          >
            ×
          </button>
        </div>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
/* The tab strip scrolls horizontally when there are many sessions, but a
   visible scrollbar is noise — that you can scroll is already obvious. */
.tabs-scroll {
  scrollbar-width: none;
}

.tabs-scroll::-webkit-scrollbar {
  display: none;
}
</style>
