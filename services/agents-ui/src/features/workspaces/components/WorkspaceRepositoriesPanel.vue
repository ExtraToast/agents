<script setup lang="ts">
import type { WorkspaceRepository } from '../types'
import { computed, ref } from 'vue'

interface Props {
  repositories: WorkspaceRepository[]
  attachPending?: boolean
  detachPendingId?: string | null
  error?: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  add: []
  detach: [repositoryId: string, repositoryName: string]
}>()

const collapsed = ref(false)
const sortedRepositories = computed(() =>
  [...props.repositories].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
    return a.name.localeCompare(b.name)
  }),
)
</script>

<template>
  <section
    class="rounded-md border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4"
    data-testid="workspace-repositories-panel"
  >
    <div class="flex items-start justify-between gap-3" :class="collapsed ? '' : 'mb-3'">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="flex size-7 shrink-0 items-center justify-center rounded text-sm text-[var(--color-text-muted)] transition-colors hover:bg-white/10 hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)]"
            :aria-expanded="!collapsed"
            aria-controls="workspace-repositories-content"
            :aria-label="collapsed ? 'Expand repositories' : 'Collapse repositories'"
            data-testid="workspace-repositories-toggle"
            @click="collapsed = !collapsed"
          >
            <span class="transition-transform" :class="collapsed ? '' : 'rotate-90'" aria-hidden="true">></span>
          </button>
          <h2 class="min-w-0 text-sm font-semibold">
            Repositories
            <span class="text-xs font-normal text-[var(--color-text-muted)]">({{ sortedRepositories.length }})</span>
          </h2>
        </div>
        <p v-if="!collapsed" class="mt-1 text-xs text-[var(--color-text-muted)]">
          Attached repositories are cloned under /workspace by repository name using GitHub App access. The primary
          repository drives defaults.
        </p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-md bg-[var(--color-accent)] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--color-accent-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-light)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-dark)] disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="attachPending"
        data-testid="workspace-add-repository"
        @click="emit('add')"
      >
        {{ attachPending ? 'Attaching...' : 'Attach' }}
      </button>
    </div>

    <div v-if="!collapsed" id="workspace-repositories-content">
      <p v-if="error" class="mb-3 rounded border border-red-500/40 bg-red-500/5 p-2 text-xs text-red-300">
        {{ error }}
      </p>

      <p v-if="sortedRepositories.length === 0" class="text-sm text-[var(--color-text-muted)] italic">
        No repositories attached.
      </p>

      <ul v-else class="space-y-3" data-testid="workspace-repositories-list">
        <li
          v-for="r in sortedRepositories"
          :key="r.id"
          class="rounded-md border border-[var(--color-surface-border)] bg-[var(--color-surface)] p-3"
          :data-testid="`workspace-repository-${r.id}`"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <RouterLink :to="`/repositories/${r.id}`" class="font-semibold hover:underline">
                  {{ r.name }}
                </RouterLink>
                <span
                  v-if="r.isPrimary"
                  class="rounded border border-blue-400/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-blue-300"
                  :data-testid="`workspace-repository-primary-${r.id}`"
                >
                  primary
                </span>
              </div>
              <p class="mt-1 truncate font-mono text-xs text-[var(--color-text-muted)]">{{ r.repoUrl }}</p>
              <p class="mt-1 text-xs text-[var(--color-text-muted)]">default: {{ r.defaultBranch }}</p>
            </div>

            <button
              v-if="!r.isPrimary"
              type="button"
              class="shrink-0 rounded-md border border-red-500/60 px-2.5 py-1.5 text-xs text-red-300 transition-colors hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-dark)] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="detachPendingId === r.id"
              :data-testid="`workspace-detach-repository-${r.id}`"
              @click="emit('detach', r.id, r.name)"
            >
              {{ detachPendingId === r.id ? 'Removing...' : 'Remove' }}
            </button>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
