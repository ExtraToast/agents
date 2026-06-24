<script setup lang="ts">
import { computed } from 'vue'
import { SubmitButton, useMutationState, useToast } from '@/lib/vueWebCommons'
import { githubAppLinks } from '../services/githubAppLinks'
import { useRepositoriesStore } from '../stores/repositories'

const props = defineProps<{ repositoryId: string; repoUrl: string }>()

const store = useRepositoriesStore()
const toast = useToast()
const recheck = useMutationState<void>()

const repositorySlug = computed(() => githubAppLinks.parseGitHubRepositoryUrl(props.repoUrl))
const owner = computed(() => repositorySlug.value?.owner ?? null)
const appSlug = computed(() => githubAppLinks.resolveGitHubAppSlug())
const installUrl = computed(() => githubAppLinks.buildGitHubAppInstallationUrlForRepo(props.repoUrl))
const installationStatus = computed(() => store.installationStatusById[props.repositoryId] ?? null)
const organizationInstallationsUrl = computed(() =>
  owner.value === null
    ? null
    : `https://github.com/organizations/${encodeURIComponent(owner.value)}/settings/installations`,
)
const signedInInstallationsUrl = 'https://github.com/settings/installations'
const appPermissionsUrl = computed(
  () => `https://github.com/settings/apps/${encodeURIComponent(appSlug.value)}/permissions`,
)
const requestedPermissions = githubAppLinks.requestedPermissions

const installStatusCopy = computed(() => {
  switch (installationStatus.value?.state) {
    case 'INSTALLED':
      return { label: 'App installed - can access this repo', tone: 'ok' as const }
    case 'NOT_INSTALLED':
      return { label: 'App not installed - install the App', tone: 'warn' as const }
    case 'UNKNOWN':
      return { label: 'Could not determine status - retry', tone: 'unknown' as const }
    default:
      return { label: 'Install status not checked yet', tone: 'unknown' as const }
  }
})

const statusToneClass = computed(() => {
  switch (installStatusCopy.value.tone) {
    case 'ok':
      return 'text-emerald-300'
    case 'warn':
      return 'text-amber-300'
    default:
      return 'text-[var(--color-text-muted)]'
  }
})

async function onRecheck(): Promise<void> {
  try {
    await recheck.run(async () => {
      await store.loadInstallationStatus(props.repositoryId)
    })
  } catch (e) {
    toast.errorFromCatch('Could not check GitHub App installation', e)
  }
}
</script>

<template>
  <section
    class="mb-6 rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4"
    data-testid="github-app-panel"
  >
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 class="text-lg font-semibold">GitHub App</h2>
        <p class="mt-1 text-sm text-[var(--color-text-muted)]">
          Repo owner:
          <span v-if="owner" class="font-mono text-[var(--color-text)]" data-testid="github-app-owner">
            {{ owner }}
          </span>
          <span v-else class="text-amber-400" data-testid="github-app-owner-missing"
            >could not parse from repo URL</span
          >
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <a
          v-if="installUrl"
          :href="installUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-light)]"
          data-testid="github-app-install-link"
        >
          Install GitHub App
        </a>
        <SubmitButton
          type="button"
          variant="secondary"
          label="Re-check"
          :status="recheck.status.value"
          data-testid="github-app-recheck"
          @click="onRecheck"
        />
      </div>
    </div>

    <div class="mt-4 rounded border border-[var(--color-surface-border)] bg-[var(--color-surface-muted)] p-3">
      <p class="text-sm font-medium" :class="statusToneClass" data-testid="github-app-install-status">
        {{ installStatusCopy.label }}
      </p>
      <p
        v-if="installationStatus?.checkedAt"
        class="mt-1 text-xs text-[var(--color-text-muted)]"
        data-testid="github-app-install-status-checked-at"
      >
        Last checked {{ new Date(installationStatus.checkedAt).toLocaleString() }}
      </p>
      <p
        v-if="installationStatus?.detail"
        class="mt-1 text-xs text-[var(--color-text-muted)]"
        data-testid="github-app-install-status-detail"
      >
        {{ installationStatus.detail }}
      </p>
      <p v-if="!owner" class="mt-1 text-xs text-amber-300" data-testid="github-app-owner-parse-warning">
        The repository owner could not be parsed from the URL, so the installation link cannot be built.
      </p>
    </div>

    <div class="mt-4 grid gap-4 md:grid-cols-2">
      <div>
        <h3 class="text-sm font-semibold">Installations</h3>
        <ul class="mt-2 space-y-2 text-sm">
          <li>
            <a
              :href="signedInInstallationsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[var(--color-accent-light)] underline"
              data-testid="github-app-user-installations-link"
            >
              Signed-in user installations
            </a>
            <p class="mt-1 text-xs text-[var(--color-text-muted)]">
              GitHub shows installations for whichever account is signed in.
            </p>
          </li>
          <li v-if="organizationInstallationsUrl">
            <a
              :href="organizationInstallationsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[var(--color-accent-light)] underline"
              data-testid="github-app-organization-installations-link"
            >
              {{ owner }} organization installations
            </a>
          </li>
        </ul>
      </div>

      <div>
        <h3 class="text-sm font-semibold">Requested permissions</h3>
        <ul class="mt-2 space-y-1 text-sm text-[var(--color-text-muted)]" data-testid="github-app-permissions">
          <li v-for="permission in requestedPermissions" :key="permission.key">
            <span class="text-[var(--color-text)]">{{ permission.label }}</span
            >:
            <span class="font-mono">{{ permission.access }}</span>
          </li>
        </ul>
        <a
          :href="appPermissionsUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-2 inline-block text-sm text-[var(--color-accent-light)] underline"
          data-testid="github-app-permissions-link"
        >
          Owner-side App permissions
        </a>
        <p class="mt-2 text-xs text-[var(--color-text-muted)]" data-testid="github-app-approval-note">
          Permission changes need approval on each installation before runner push, PR, and Actions access update.
        </p>
      </div>
    </div>
  </section>
</template>
