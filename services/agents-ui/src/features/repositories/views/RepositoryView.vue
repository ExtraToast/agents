<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SubmitButton, useMutationState, useToast } from '@/lib/vueWebCommons'
import AccessStatusBadge from '../components/AccessStatusBadge.vue'
import GitHubAppPanel from '../components/GitHubAppPanel.vue'
import { useRepositoriesStore } from '../stores/repositories'

const route = useRoute()
const router = useRouter()
const store = useRepositoriesStore()
const toast = useToast()

const id = computed(() => String(route.params.id))
const detail = computed(() => store.detailById[id.value])
const verify = computed(() => detail.value?.verify)
const installationStatus = computed(() => store.installationStatusById[id.value] ?? null)
const destroy = useMutationState<void>()
const verifyState = useMutationState<void>()

onMounted(async () => {
  try {
    await store.loadDetail(id.value)
  } catch (e) {
    toast.errorFromCatch('Could not load the repository', e)
  }
  try {
    await store.loadInstallationStatus(id.value)
  } catch (e) {
    toast.errorFromCatch('Could not check GitHub App installation', e)
  }
})

async function runVerify(): Promise<void> {
  try {
    await verifyState.run(async () => {
      await store.verify(id.value)
    })
  } catch (e) {
    toast.errorFromCatch('Could not verify repository access', e)
  }
}

async function onDestroy(): Promise<void> {
  // See ProjectView for the rationale on using window.confirm.
  // eslint-disable-next-line no-alert
  if (!window.confirm('Delete this repository? Projects linked to it lose the link.')) return
  try {
    await destroy.run(async () => {
      await store.destroy(id.value)
    })
    toast.success('Repository deleted')
    await router.push('/repositories')
  } catch (e) {
    toast.errorFromCatch('Could not delete the repository', e)
  }
}
</script>

<template>
  <div v-if="detail" class="max-w-4xl mx-auto p-6" data-testid="repository-detail">
    <header class="mb-6 flex items-baseline justify-between">
      <div>
        <h1 class="text-2xl font-bold">{{ detail.repository.name }}</h1>
        <p class="mt-1 font-mono text-xs text-[var(--color-text-muted)]">{{ detail.repository.repoUrl }}</p>
      </div>
      <SubmitButton type="button" variant="danger" label="Delete" :status="destroy.status.value" @click="onDestroy" />
    </header>

    <GitHubAppPanel :repository-id="detail.repository.id" :repo-url="detail.repository.repoUrl" />

    <section class="mb-6 rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
      <div class="flex items-baseline justify-between">
        <h2 class="text-lg font-semibold">Access</h2>
        <SubmitButton
          type="button"
          variant="secondary"
          label="Verify access"
          :status="verifyState.status.value"
          data-testid="repository-verify"
          @click="runVerify"
        />
      </div>
      <div class="mt-3">
        <AccessStatusBadge :verify="verify" :installation-status="installationStatus" />
        <p v-if="verify" class="mt-2 text-xs text-[var(--color-text-muted)]" data-testid="repository-verify-checked-at">
          Last checked {{ new Date(verify.checkedAt).toLocaleString() }}
        </p>
        <ul
          v-if="verify && verify.messages.length > 0"
          class="mt-2 space-y-1 text-xs text-[var(--color-text-muted)]"
          data-testid="repository-verify-messages"
        >
          <li v-for="(msg, i) in verify.messages" :key="i">{{ msg }}</li>
        </ul>
        <p
          v-if="verify && verify.defaultBranchProtected === false"
          class="mt-2 text-xs text-amber-400"
          data-testid="repository-protection-warning"
        >
          The default branch is unprotected. Enable branch protection (block force-push + deletion) on GitHub so the
          agent cannot rewrite or delete history.
        </p>
        <p
          v-else-if="verify && verify.defaultBranchProtected === null"
          class="mt-2 text-xs text-[var(--color-text-muted)]"
          data-testid="repository-protection-unknown"
        >
          Branch protection could not be checked — no GitHub API token is configured.
        </p>
      </div>
    </section>

    <section class="rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
      <h2 class="text-lg font-semibold">Linked projects</h2>
      <ul v-if="detail.attachedProjects.length > 0" class="mt-2 space-y-1">
        <li v-for="p in detail.attachedProjects" :key="p.id">
          <RouterLink
            :to="`/projects/${p.id}`"
            class="text-sm text-[var(--color-accent-light)] hover:underline"
            :data-testid="`linked-project-${p.id}`"
          >
            {{ p.name }} <span class="text-[var(--color-text-muted)] font-mono">project:{{ p.slug }}</span>
          </RouterLink>
        </li>
      </ul>
      <p v-else class="mt-2 text-sm text-[var(--color-text-muted)]">
        Not linked to any project yet. Open a project and add this repository to its pool.
      </p>
    </section>
</div>
  <div v-else class="max-w-4xl mx-auto p-6 text-[var(--color-text-muted)]">Loading…</div>
</template>
